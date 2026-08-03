import type {
	DataTexture,
	Mesh,
	OrthographicCamera,
	PlaneGeometry,
	Scene,
	ShaderMaterial,
	Texture,
	WebGLRenderer,
	WebGLRenderTarget
} from 'three';
import { resolveDistortPhase, type ShallowWaterParameters } from './shared.js';

type ThreeModule = typeof import('three');

const vertexShader = /* glsl */ `
	varying vec2 vUv;
	void main() {
		vUv = uv;
		gl_Position = vec4(position.xy, 0.0, 1.0);
	}
`;

const computeFragmentShader = /* glsl */ `
	precision highp float;
	varying vec2 vUv;
	uniform sampler2D stateTexture;
	uniform vec2 texelSize;
	uniform float waveSpeed;
	uniform float damping;
	uniform float edgeAbsorb;
	uniform float gridSize;
	uniform float guardBand;
	uniform float restThreshold;
	uniform vec2 baseFlow;
	uniform float distortStrength;
	uniform float distortScale;
	uniform float distortPhase;

	float hash21(vec2 point) {
		return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
	}

	float valueNoise(vec2 point) {
		vec2 cell = floor(point);
		vec2 local = fract(point);
		local = local * local * (3.0 - 2.0 * local);
		return mix(
			mix(hash21(cell), hash21(cell + vec2(1.0, 0.0)), local.x),
			mix(hash21(cell + vec2(0.0, 1.0)), hash21(cell + vec2(1.0, 1.0)), local.x),
			local.y
		);
	}

	float distortNoise(vec2 point) {
		vec2 drift = vec2(distortPhase, distortPhase * -0.73);
		return valueNoise(point + drift) * 0.67
			+ valueNoise(point * 2.03 - drift * 0.41) * 0.33;
	}

	vec2 curlNoise(vec2 point) {
		const float epsilon = 0.08;
		float dx = distortNoise(point + vec2(epsilon, 0.0))
			- distortNoise(point - vec2(epsilon, 0.0));
		float dy = distortNoise(point + vec2(0.0, epsilon))
			- distortNoise(point - vec2(0.0, epsilon));
		vec2 curl = vec2(dy, -dx) / (2.0 * epsilon);
		return curl / max(1.0, length(curl));
	}

	vec2 clampSampleUv(vec2 uv) {
		return clamp(uv, texelSize * 0.5, vec2(1.0) - texelSize * 0.5);
	}

	float sampleHeight(vec2 uv) {
		return texture2D(stateTexture, clampSampleUv(uv)).r;
	}

	void main() {
		vec2 flow = baseFlow;
		if (distortStrength > 0.0) {
			float visibleGridSize = max(1.0, gridSize - 2.0 * guardBand);
			vec2 distortPoint = (vUv - 0.5) * (gridSize / visibleGridSize) * distortScale;
			flow += curlNoise(distortPoint) * distortStrength;
		}
		float flowLength = length(flow);
		if (flowLength > 1.5) {
			flow *= 1.5 / flowLength;
		}

		vec2 sourceUv = clampSampleUv(vUv - flow * texelSize);
		vec4 state = texture2D(stateTexture, sourceUv);
		float height = state.r;
		float previous = state.g;
		float north = sampleHeight(sourceUv + vec2(0.0, texelSize.y));
		float south = sampleHeight(sourceUv - vec2(0.0, texelSize.y));
		float east = sampleHeight(sourceUv + vec2(texelSize.x, 0.0));
		float west = sampleHeight(sourceUv - vec2(texelSize.x, 0.0));
		float laplacian = north + south + east + west - 4.0 * height;
		float nextHeight = 2.0 * height - previous + waveSpeed * laplacian;
		nextHeight *= damping;

		float edgeDistance = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)) * gridSize;
		float spongeWidth = edgeAbsorb * guardBand;
		float edgeFactor = spongeWidth <= 0.0 ? 1.0 : smoothstep(0.0, spongeWidth, edgeDistance);
		nextHeight *= edgeFactor;
		nextHeight = clamp(nextHeight, -4.0, 4.0);
		float previousHeight = height * edgeFactor;
		float restMotion = max(
			max(abs(nextHeight), abs(previousHeight)),
			abs(nextHeight - previousHeight)
		);
		if (restMotion < restThreshold) {
			nextHeight = 0.0;
			previousHeight = 0.0;
		}

		gl_FragColor = vec4(nextHeight, previousHeight, state.b, state.a);
	}
`;

const seedFragmentShader = /* glsl */ `
	precision highp float;
	varying vec2 vUv;
	uniform sampler2D seedTexture;
	uniform float seedMaxHeight;

	void main() {
		vec4 seed = texture2D(seedTexture, vUv);
		float encoded = (seed.r * 255.0 * 256.0 + seed.g * 255.0) / 65535.0;
		float height = encoded * seedMaxHeight;
		gl_FragColor = vec4(height, height, 0.0, 1.0);
	}
`;

const displayFragmentShader = /* glsl */ `
	precision highp float;
	varying vec2 vUv;
	uniform sampler2D stateTexture;
	uniform float contrast;
	uniform float guardRatio;

	void main() {
		vec2 cropUv = vec2(guardRatio) + vUv * (1.0 - 2.0 * guardRatio);
		float height = texture2D(stateTexture, cropUv).r;
		float gray = clamp(0.5 + height * contrast, 0.0, 1.0);
		gl_FragColor = vec4(vec3(gray), 1.0);
	}
`;

const SEED_MAX_HEIGHT = 2;

export class ShallowWaterWaveRenderer {
	readonly canvas: HTMLCanvasElement;
	private readonly THREE: ThreeModule;
	private readonly renderer: WebGLRenderer;
	private readonly scene: Scene;
	private readonly camera: OrthographicCamera;
	private readonly quad: Mesh;
	private readonly geometry: PlaneGeometry;
	private readonly seedMaterial: ShaderMaterial;
	private readonly computeMaterial: ShaderMaterial;
	private readonly displayMaterial: ShaderMaterial;
	private readonly targets: [WebGLRenderTarget, WebGLRenderTarget];
	private readonly visibleSize: number;
	private readonly simSize: number;
	private readonly guardBand: number;
	private dataTexture: DataTexture | null = null;
	private currentTexture: Texture | null = null;
	private nextTargetIndex = 0;
	private simulationStep = 0;

	constructor(THREE: ThreeModule, canvas: HTMLCanvasElement, visibleSize: number) {
		this.THREE = THREE;
		this.canvas = canvas;
		this.visibleSize = visibleSize;
		this.guardBand = Math.min(Math.round(visibleSize * 0.5), 256);
		this.simSize = visibleSize + 2 * this.guardBand;
		this.renderer = new THREE.WebGLRenderer({
			canvas,
			antialias: false,
			alpha: false,
			preserveDrawingBuffer: true
		});
		this.renderer.setPixelRatio(1);
		this.renderer.setSize(visibleSize, visibleSize, false);
		this.renderer.setClearColor(0x000000, 1);

		this.scene = new THREE.Scene();
		this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
		this.geometry = new THREE.PlaneGeometry(2, 2);
		this.seedMaterial = new THREE.ShaderMaterial({
			vertexShader,
			fragmentShader: seedFragmentShader,
			uniforms: {
				seedTexture: { value: null },
				seedMaxHeight: { value: SEED_MAX_HEIGHT }
			},
			depthTest: false,
			depthWrite: false
		});
		this.computeMaterial = new THREE.ShaderMaterial({
			vertexShader,
			fragmentShader: computeFragmentShader,
			uniforms: {
				stateTexture: { value: null },
				texelSize: { value: new THREE.Vector2(1 / this.simSize, 1 / this.simSize) },
				waveSpeed: { value: 0.16 },
				damping: { value: 0.992 },
				edgeAbsorb: { value: 0.9 },
				gridSize: { value: this.simSize },
				guardBand: { value: this.guardBand },
				restThreshold: { value: 0.0001 },
				baseFlow: { value: new THREE.Vector2(0, 0) },
				distortStrength: { value: 0 },
				distortScale: { value: 4 },
				distortPhase: { value: 0 }
			},
			depthTest: false,
			depthWrite: false
		});
		this.displayMaterial = new THREE.ShaderMaterial({
			vertexShader,
			fragmentShader: displayFragmentShader,
			uniforms: {
				stateTexture: { value: null },
				contrast: { value: 1.8 },
				guardRatio: { value: this.guardBand / this.simSize }
			},
			depthTest: false,
			depthWrite: false
		});
		this.quad = new THREE.Mesh(this.geometry, this.displayMaterial);
		this.scene.add(this.quad);
		this.targets = [this.createTarget(), this.createTarget()];
	}

	setInitialHeight(heightData: Float32Array) {
		const stateData = new Uint8Array(this.simSize * this.simSize * 4);
		for (let vy = 0; vy < this.visibleSize; vy += 1) {
			for (let vx = 0; vx < this.visibleSize; vx += 1) {
				const srcIndex = vy * this.visibleSize + vx;
				const dstX = vx + this.guardBand;
				const dstY = vy + this.guardBand;
				const dstIndex = (dstY * this.simSize + dstX) * 4;
				const normalizedHeight = Math.min(1, Math.max(0, (heightData[srcIndex] ?? 0) / SEED_MAX_HEIGHT));
				const encodedHeight = Math.round(normalizedHeight * 65535);
				stateData[dstIndex] = encodedHeight >> 8;
				stateData[dstIndex + 1] = encodedHeight & 255;
				stateData[dstIndex + 2] = 0;
				stateData[dstIndex + 3] = 255;
			}
		}

		this.dataTexture?.dispose();
		this.dataTexture = new this.THREE.DataTexture(
			stateData,
			this.simSize,
			this.simSize,
			this.THREE.RGBAFormat,
			this.THREE.UnsignedByteType
		);
		this.dataTexture.minFilter = this.THREE.NearestFilter;
		this.dataTexture.magFilter = this.THREE.NearestFilter;
		this.dataTexture.wrapS = this.THREE.ClampToEdgeWrapping;
		this.dataTexture.wrapT = this.THREE.ClampToEdgeWrapping;
		this.dataTexture.needsUpdate = true;

		const seedTarget = this.targets[0];
		this.seedMaterial.uniforms.seedTexture.value = this.dataTexture;
		this.quad.material = this.seedMaterial;
		this.renderer.setRenderTarget(seedTarget);
		this.renderer.setViewport(0, 0, this.simSize, this.simSize);
		this.renderer.render(this.scene, this.camera);
		this.renderer.setRenderTarget(null);
		this.renderer.setViewport(0, 0, this.visibleSize, this.visibleSize);
		this.currentTexture = seedTarget.texture;
		this.nextTargetIndex = 1;
		this.simulationStep = 0;
	}

	step(parameters: ShallowWaterParameters) {
		if (!this.currentTexture) return;

		this.computeMaterial.uniforms.stateTexture.value = this.currentTexture;
		this.computeMaterial.uniforms.waveSpeed.value = parameters.waveSpeed;
		this.computeMaterial.uniforms.damping.value = this.resolveStepDamping(parameters.damping);
		this.computeMaterial.uniforms.edgeAbsorb.value = parameters.edgeAbsorb;
		this.computeMaterial.uniforms.restThreshold.value = parameters.restThreshold;
		this.computeMaterial.uniforms.baseFlow.value.set(parameters.flowX, parameters.flowY);
		this.computeMaterial.uniforms.distortStrength.value = parameters.distortStrength;
		this.computeMaterial.uniforms.distortScale.value = parameters.distortScale;
		this.computeMaterial.uniforms.distortPhase.value = resolveDistortPhase(
			this.simulationStep,
			parameters.distortSpeed,
			this.resolveResolutionScale()
		);
		this.quad.material = this.computeMaterial;

		const target = this.targets[this.nextTargetIndex];
		this.renderer.setRenderTarget(target);
		this.renderer.setViewport(0, 0, this.simSize, this.simSize);
		this.renderer.render(this.scene, this.camera);
		this.renderer.setRenderTarget(null);
		this.renderer.setViewport(0, 0, this.visibleSize, this.visibleSize);
		this.currentTexture = target.texture;
		this.nextTargetIndex = 1 - this.nextTargetIndex;
		this.simulationStep += 1;
	}

	render(parameters: ShallowWaterParameters) {
		this.displayMaterial.uniforms.stateTexture.value = this.currentTexture;
		this.displayMaterial.uniforms.contrast.value = parameters.contrast;
		this.quad.material = this.displayMaterial;
		this.renderer.setRenderTarget(null);
		this.renderer.setViewport(0, 0, this.visibleSize, this.visibleSize);
		this.renderer.render(this.scene, this.camera);
	}

	advanceFrames(frameCount: number, parameters: ShallowWaterParameters) {
		const steps = this.resolveFrameStepCount(frameCount, parameters);
		for (let index = 0; index < steps; index += 1) {
			this.step(parameters);
		}
	}

	dispose() {
		this.dataTexture?.dispose();
		this.targets[0].dispose();
		this.targets[1].dispose();
		this.seedMaterial.dispose();
		this.computeMaterial.dispose();
		this.displayMaterial.dispose();
		this.geometry.dispose();
		this.renderer.dispose();
	}

	private createTarget(): WebGLRenderTarget {
		return new this.THREE.WebGLRenderTarget(this.simSize, this.simSize, {
			wrapS: this.THREE.ClampToEdgeWrapping,
			wrapT: this.THREE.ClampToEdgeWrapping,
			minFilter: this.THREE.LinearFilter,
			magFilter: this.THREE.LinearFilter,
			format: this.THREE.RGBAFormat,
			type: this.THREE.HalfFloatType,
			depthBuffer: false,
			stencilBuffer: false
		});
	}

	private resolveResolutionScale(): number {
		return Math.max(0.5, this.visibleSize / 256);
	}

	private resolveFrameStepCount(frameCount: number, parameters: ShallowWaterParameters): number {
		const frames = Math.max(0, Math.round(frameCount));
		if (frames === 0) return 0;

		const stepsPerFrame = Math.max(
			1,
			Math.round(parameters.stepsPerFrame * this.resolveResolutionScale())
		);
		return frames * stepsPerFrame;
	}

	private resolveStepDamping(damping: number): number {
		return Math.pow(damping, 1 / this.resolveResolutionScale());
	}
}