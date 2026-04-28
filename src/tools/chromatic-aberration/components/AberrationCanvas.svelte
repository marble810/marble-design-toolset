<script lang="ts">
	import { onMount } from 'svelte';
	import { loadTechStack } from '$lib/runtime/tech-stack';
	import { getToolSessionContext } from '$lib/runtime/tool-session-context';
	import { getCanvasExportContext } from '$lib/runtime/canvas-export/context';
	import type { Application, Sprite, Texture, Filter } from 'pixi.js';

	// ──────────────────────────────────────────────────────────────────────────
	// Props
	// ──────────────────────────────────────────────────────────────────────────
	interface Props {
		objectUrl: string | null;
		sourceKind: 'image' | 'video' | null;
		sourceWidth: number;
		sourceHeight: number;
		// Lens warp
		warpCenterX: number;
		warpCenterY: number;
		warpDist: number;
		// Chromatic dispersion
		radialStrength: number;
		redRadial: number;
		greenRadial: number;
		blueRadial: number;
		// Linear channel offsets (pixels)
		redOffsetX: number;
		redOffsetY: number;
		greenOffsetX: number;
		greenOffsetY: number;
		blueOffsetX: number;
		blueOffsetY: number;
		// Blend
		mix: number;
		// Callback: reports the actual resolved render dimensions back to the parent
		// (needed when video metadata returns 0x0 and the video element's real size is used)
		onResolvedSize?: (w: number, h: number) => void;
	}

	let {
		objectUrl,
		sourceKind,
		sourceWidth,
		sourceHeight,
		warpCenterX,
		warpCenterY,
		warpDist,
		radialStrength,
		redRadial,
		greenRadial,
		blueRadial,
		redOffsetX,
		redOffsetY,
		greenOffsetX,
		greenOffsetY,
		blueOffsetX,
		blueOffsetY,
		mix,
		onResolvedSize
	}: Props = $props();

	// ──────────────────────────────────────────────────────────────────────────
	// DOM refs & Pixi instances
	// ──────────────────────────────────────────────────────────────────────────
	let hostElement = $state<HTMLDivElement | null>(null);
	let isReady = $state(false);
	let errorMessage = $state('');

	let pixiApp: Application | null = null;
	let sourceSprite: Sprite | null = null;
	let caFilter: Filter | null = null;
	let caUniforms: ReturnType<typeof buildUniformGroup> | null = null;
	// Track the currently active video element for lifecycle management
	let activeVideoEl = $state<HTMLVideoElement | null>(null);

	const toolSessionContext = getToolSessionContext();
	const isSessionActive = $derived(toolSessionContext?.isActive() ?? true);

	// Export context — must be read at component init time (script top-level)
	const exportContext = getCanvasExportContext();
	let unregisterExporter: (() => void) | null = null;

	// ──────────────────────────────────────────────────────────────────────────
	// Chromatic Aberration GLSL (GLSL ES 300 – PixiJS v8 default)
	// ──────────────────────────────────────────────────────────────────────────
	// Lens warp model:
	//   For each channel C:
	//     k_C = warpDist + channelRadial_C * radialStrength
	//     coord_from_center = tc - warpCenter
	//     r2 = dot(coord_from_center, coord_from_center)
	//     uv_C = warpCenter + coord_from_center * (1.0 + k_C * r2)
	//              + linearOffset_C / resolution
	//   When k_C > 0 → outward push (barrel)
	//   When k_C < 0 → inward pull (pincushion)
	//   Final = mix(original, channelBlended, uMix)
	// ──────────────────────────────────────────────────────────────────────────

	const CA_VERTEX_GLSL = /* glsl */ `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void) {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void) {
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void) {
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}
`;

	const CA_FRAGMENT_GLSL = /* glsl */ `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform vec2 uWarpCenter;
uniform float uWarpDist;
uniform float uRadialStrength;
uniform float uRedRadial;
uniform float uGreenRadial;
uniform float uBlueRadial;
uniform vec2 uRedOffset;
uniform vec2 uGreenOffset;
uniform vec2 uBlueOffset;
uniform float uMix;

vec2 lensWarp(vec2 tc, float k) {
    vec2 d = tc - uWarpCenter;
    float r2 = dot(d, d);
    return uWarpCenter + d * (1.0 + k * r2);
}

void main(void) {
    vec4 original = texture(uTexture, vTextureCoord);

    // Per-channel distortion factor
    float kR = uWarpDist + uRedRadial   * uRadialStrength;
    float kG = uWarpDist + uGreenRadial * uRadialStrength;
    float kB = uWarpDist + uBlueRadial  * uRadialStrength;

    // Compute warped UV + linear pixel offset
    vec2 uvR = lensWarp(vTextureCoord, kR) + uRedOffset   / uResolution;
    vec2 uvG = lensWarp(vTextureCoord, kG) + uGreenOffset / uResolution;
    vec2 uvB = lensWarp(vTextureCoord, kB) + uBlueOffset  / uResolution;

    // Clamp to valid UV range
    uvR = clamp(uvR, vec2(0.0), vec2(1.0));
    uvG = clamp(uvG, vec2(0.0), vec2(1.0));
    uvB = clamp(uvB, vec2(0.0), vec2(1.0));

    float r = texture(uTexture, uvR).r;
    float g = texture(uTexture, uvG).g;
    float b = texture(uTexture, uvB).b;
    float a = original.a;

    vec4 aberrated = vec4(r, g, b, a);
    finalColor = mix(original, aberrated, uMix);
}
`;

	// ──────────────────────────────────────────────────────────────────────────
	// Uniform group factory
	// ──────────────────────────────────────────────────────────────────────────
	function buildUniformGroup(PIXI: typeof import('pixi.js')) {
		return new PIXI.UniformGroup({
			uResolution: { value: new Float32Array([800, 600]), type: 'vec2<f32>' },
			uWarpCenter: { value: new Float32Array([0.5, 0.5]), type: 'vec2<f32>' },
			uWarpDist: { value: 0.0, type: 'f32' },
			uRadialStrength: { value: 0.3, type: 'f32' },
			uRedRadial: { value: -1.0, type: 'f32' },
			uGreenRadial: { value: 0.0, type: 'f32' },
			uBlueRadial: { value: 1.0, type: 'f32' },
			uRedOffset: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
			uGreenOffset: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
			uBlueOffset: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
			uMix: { value: 1.0, type: 'f32' }
		});
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Update uniforms when props change
	// ──────────────────────────────────────────────────────────────────────────
	function syncUniforms() {
		if (!caUniforms) return;
		const u = caUniforms.uniforms;
		// Use the renderer's actual pixel dimensions so the pixel-offset shader math
		// stays accurate for images and videos regardless of the prop value.
		u.uResolution[0] = pixiApp?.renderer.width  ?? sourceWidth;
		u.uResolution[1] = pixiApp?.renderer.height ?? sourceHeight;
		u.uWarpCenter[0] = warpCenterX;
		u.uWarpCenter[1] = warpCenterY;
		u.uWarpDist = warpDist;
		u.uRadialStrength = radialStrength;
		u.uRedRadial = redRadial;
		u.uGreenRadial = greenRadial;
		u.uBlueRadial = blueRadial;
		u.uRedOffset[0] = redOffsetX;
		u.uRedOffset[1] = redOffsetY;
		u.uGreenOffset[0] = greenOffsetX;
		u.uGreenOffset[1] = greenOffsetY;
		u.uBlueOffset[0] = blueOffsetX;
		u.uBlueOffset[1] = blueOffsetY;
		u.uMix = mix;
		caUniforms.update();
	}

	// ──────────────────────────────────────────────────────────────────────────
	// React to uniform prop changes
	// ──────────────────────────────────────────────────────────────────────────
	$effect(() => {
		// Subscribe to all relevant uniforms
		warpCenterX; warpCenterY; warpDist;
		radialStrength;
		redRadial; greenRadial; blueRadial;
		redOffsetX; redOffsetY;
		greenOffsetX; greenOffsetY;
		blueOffsetX; blueOffsetY;
		mix;
		sourceWidth; sourceHeight;

		if (isReady && isSessionActive) {
			syncUniforms();
			pixiApp?.render();
		}
	});

	// ──────────────────────────────────────────────────────────────────────────
	// Session active/inactive: pause / resume video + ticker together
	// ──────────────────────────────────────────────────────────────────────────
	$effect(() => {
		const videoEl = activeVideoEl;
		if (!isReady || !pixiApp || !videoEl) return;
		if (isSessionActive) {
			void videoEl.play().catch(() => undefined);
			pixiApp.ticker.start();
		} else {
			videoEl.pause();
			pixiApp.ticker.stop();
		}
	});

	// ──────────────────────────────────────────────────────────────────────────
	// React to source URL changes – load new texture
	// ──────────────────────────────────────────────────────────────────────────
	$effect(() => {
		const url = objectUrl;
		const kind = sourceKind;
		if (!isReady || !pixiApp || !sourceSprite) return;
		void loadSourceTexture(url, kind);
	});

	/** Release the currently tracked video element and stop the ticker. */
	function releaseVideo() {
		if (activeVideoEl) {
			activeVideoEl.pause();
			activeVideoEl.src = '';
			activeVideoEl.load(); // triggers browser resource release
			activeVideoEl = null;
		}
		pixiApp?.ticker.stop();
	}

	async function loadSourceTexture(url: string | null, kind: 'image' | 'video' | null) {
		if (!pixiApp || !sourceSprite) return;
		if (!url || !kind) {
			// No source – stop video, show placeholder
			releaseVideo();
			sourceSprite.texture = (await loadTechStack('pixi')).Texture.EMPTY;
			pixiApp.renderer.resize(800, 600);
			pixiApp.render();
			return;
		}
		try {
			const PIXI = await loadTechStack('pixi');
			if (kind === 'video') {
				// Release the previous video before creating a new one
				releaseVideo();
				const videoEl = document.createElement('video');
				videoEl.loop = true;
				videoEl.muted = true;
				videoEl.playsInline = true;
				videoEl.src = url;
				// Explicitly trigger network fetch (required for blob URLs in some browsers)
				videoEl.load();

				// ── Wait for first decoded frame ────────────────────────────────────
				// requestVideoFrameCallback (RVFC) fires only after the first frame is
				// fully decoded, guaranteeing non-zero videoWidth/videoHeight.
				// This is critical for 4K/HEVC files where canplay/loadeddata fire too
				// early and dimensions are still 0.
				type RVFC = (callback: () => void) => void;
				const hasRVFC = typeof (videoEl as unknown as { requestVideoFrameCallback?: RVFC })
					.requestVideoFrameCallback === 'function';

				if (hasRVFC) {
					// RVFC path: play → first frame decoded → pause → dimensions ready
					await new Promise<void>((resolve) => {
						(videoEl as unknown as { requestVideoFrameCallback: RVFC })
							.requestVideoFrameCallback(() => resolve());
						videoEl.play().catch(() => resolve()); // error also resolves
					});
					videoEl.pause();
				} else {
					// Fallback path: loadeddata → canplay if dimensions still 0
					await new Promise<void>((resolve) => {
						if (videoEl.readyState >= 2) { resolve(); return; }
						videoEl.addEventListener('loadeddata', () => resolve(), { once: true });
						videoEl.addEventListener('error', () => resolve(), { once: true });
					});
					if (videoEl.videoWidth === 0 || videoEl.videoHeight === 0) {
						await new Promise<void>((resolve) => {
							if (videoEl.readyState >= 3) { resolve(); return; }
							const timer = setTimeout(resolve, 8000);
							const done = () => { clearTimeout(timer); resolve(); };
							videoEl.addEventListener('canplay', done, { once: true });
							videoEl.addEventListener('error', done, { once: true });
						});
					}
				}

				if (!sourceSprite || !pixiApp) return;

				const vidW = videoEl.videoWidth  > 0 ? videoEl.videoWidth  : (sourceWidth  || 800);
				const vidH = videoEl.videoHeight > 0 ? videoEl.videoHeight : (sourceHeight || 600);

				// CRITICAL: create Texture while video is PAUSED.
				// PixiJS VideoSource registers for the 'play' event at construction time.
				// If the video is already playing when Texture.from() is called, that
				// event is missed and per-frame GPU uploads never start → black screen.
				const tex: Texture = PIXI.Texture.from(videoEl);
				activeVideoEl = videoEl; // track after everything succeeds
				sourceSprite.texture = tex;
				sourceSprite.width = vidW;
				sourceSprite.height = vidH;
				pixiApp.renderer.resize(vidW, vidH);
				// Inform parent of the resolved render size so PreviewCanvas stays accurate
				onResolvedSize?.(vidW, vidH);

				// Start ticker then play: VideoSource catches the play event and hooks
				// into the ticker for per-frame uploads.
				if (isSessionActive) {
					pixiApp.ticker.start();
					await videoEl.play().catch(() => undefined);
				}
			} else {
				// Release any previous video when switching to image
				releaseVideo();
				// Load via HTMLImageElement to avoid blob-URL extension detection issues
				const img = await new Promise<HTMLImageElement>((resolve, reject) => {
					const el = new Image();
					el.onload = () => resolve(el);
					el.onerror = () => reject(new Error('Image load failed'));
					el.src = url;
				});
				if (!sourceSprite || !pixiApp) return;
				const tex: Texture = PIXI.Texture.from(img);
				sourceSprite.texture = tex;
				sourceSprite.width = sourceWidth;
				sourceSprite.height = sourceHeight;
				pixiApp.renderer.resize(sourceWidth, sourceHeight);
				pixiApp.render();
			}
		} catch (_) {
			// Texture load failure – leave previous state intact
		}
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Lifecycle
	// ──────────────────────────────────────────────────────────────────────────
	onMount(() => {
		let disposed = false;

		void (async () => {
			try {
				const PIXI = await loadTechStack('pixi');
				if (disposed || !hostElement) return;

				// Build the CA filter
				caUniforms = buildUniformGroup(PIXI);
				const glProgram = PIXI.GlProgram.from({
					vertex: CA_VERTEX_GLSL,
					fragment: CA_FRAGMENT_GLSL,
					name: 'chromatic-aberration-filter'
				});
				caFilter = new PIXI.Filter({
					glProgram,
					resources: { caUniforms }
				});

				pixiApp = new PIXI.Application();
				await pixiApp.init({
					width: sourceWidth || 800,
					height: sourceHeight || 600,
					backgroundAlpha: 0,
					resolution: 1,
					autoDensity: false,
					antialias: false,
					autoStart: false
				});

				if (disposed) {
					pixiApp.destroy({ removeView: true }, { children: true });
					return;
				}

				hostElement.replaceChildren(pixiApp.canvas);

				sourceSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
				sourceSprite.width = sourceWidth || 800;
				sourceSprite.height = sourceHeight || 600;
				sourceSprite.filters = [caFilter];
				pixiApp.stage.addChild(sourceSprite);

				// Sync initial uniforms before first render
				syncUniforms();
				isReady = true;

				// Register export — force-render in getCanvas() ensures the WebGL
				// drawing buffer is current at the moment of capture.
				unregisterExporter = exportContext?.register({
					kind: 'canvas',
					get contentWidth()  { return pixiApp?.renderer.width  ?? sourceWidth; },
					get contentHeight() { return pixiApp?.renderer.height ?? sourceHeight; },
					getCanvas: () => {
						if (!pixiApp) return null;
						syncUniforms();
						pixiApp.render(); // ensure buffer is current before capture
						return pixiApp.canvas as HTMLCanvasElement;
					}
				}) ?? null;

				// Load initial source if provided
				if (objectUrl && sourceKind) {
					await loadSourceTexture(objectUrl, sourceKind);
				} else {
					pixiApp.render();
				}
			} catch (error) {
				errorMessage =
					error instanceof Error ? error.message : 'Failed to initialize Pixi renderer.';
			}
		})();

		return () => {
			disposed = true;
			unregisterExporter?.();
			unregisterExporter = null;
			// Release video element first so its resources are freed before Pixi teardown
			releaseVideo();
			if (pixiApp) {
				pixiApp.destroy({ removeView: true }, { children: true });
				pixiApp = null;
			}
			sourceSprite = null;
			caFilter = null;
			caUniforms = null;
			hostElement?.replaceChildren();
		};
	});
</script>

<div class="aberration-canvas">
	<div class="aberration-canvas__host" bind:this={hostElement}></div>

	{#if !isReady && !errorMessage}
		<div class="aberration-canvas__overlay">Loading renderer…</div>
	{/if}

	{#if errorMessage}
		<div class="aberration-canvas__overlay aberration-canvas__overlay--error">{errorMessage}</div>
	{/if}

	{#if isReady && !objectUrl}
		<div class="aberration-canvas__placeholder">
			<p>Drop an image or video here, or use Browse in the left panel.</p>
		</div>
	{/if}
</div>

<style>
	.aberration-canvas {
		position: relative;
		width: 100%;
		height: 100%;
	}

	.aberration-canvas__host {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.aberration-canvas__overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.45);
		color: var(--color-fg-secondary);
		font-size: var(--font-size-1);
	}

	.aberration-canvas__overlay--error {
		color: var(--color-danger);
	}

	.aberration-canvas__placeholder {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}

	.aberration-canvas__placeholder p {
		margin: 0;
		font-size: var(--font-size-1);
		color: var(--color-fg-muted);
		text-align: center;
		max-width: 220px;
		line-height: 1.5;
	}
</style>
