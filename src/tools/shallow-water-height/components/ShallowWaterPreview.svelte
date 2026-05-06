<script lang="ts">
	import { onMount } from 'svelte';
	import { getCanvasExportContext } from '$lib/runtime/canvas-export/context';
	import { getToolSessionContext } from '$lib/runtime/tool-session-context';
	import { loadTechStack } from '$lib/runtime/tech-stack';
	import {
		createInitMapSourceKey,
		type InitMapSourceMode,
		type ShallowWaterInitMapSource,
		type ShallowWaterParameters
	} from '../simulation/shared.js';
	import { loadInitMapHeightData } from '../simulation/image-height.js';
	import { ShallowWaterWaveRenderer } from '../simulation/wave-renderer.js';

	type ThreeModule = typeof import('three');

	interface Props {
		initMapSource: ShallowWaterInitMapSource | null;
		sourceMode: InitMapSourceMode;
		parameters: ShallowWaterParameters;
		resimulateToken: number;
	}

	let { initMapSource, sourceMode, parameters, resimulateToken }: Props = $props();

	const exportContext = getCanvasExportContext();
	const toolSessionContext = getToolSessionContext();

	let canvasElement = $state<HTMLCanvasElement | null>(null);
	let isReady = $state(false);
	let isLoadingMap = $state(false);
	let errorMessage = $state('');
	let isSessionActive = $derived(toolSessionContext?.isActive() ?? true);

	let THREE: ThreeModule | null = null;
	let previewRenderer: ShallowWaterWaveRenderer | null = null;
	let previewResolution = 0;
	let previewInitialData: Float32Array | null = null;
	let previewKey = '';
	let loadVersion = 0;

	let exportRenderer: ShallowWaterWaveRenderer | null = null;
	let exportResolution = 0;
	let exportRenderCanvas: HTMLCanvasElement | null = null;
	let exportInitialData: Float32Array | null = null;
	let exportKey = '';
	let exportFrame = -1;

	const structuralKey = $derived(
		initMapSource
			? [
					createInitMapSourceKey(initMapSource),
					parameters.resolution,
					parameters.amplitude,
					parameters.invert,
					resimulateToken
				].join('|')
			: ''
	);

	$effect(() => {
		if (!THREE || !canvasElement || !isReady) return;
		if (!previewRenderer || previewResolution !== parameters.resolution) {
			previewRenderer?.dispose();
			previewRenderer = new ShallowWaterWaveRenderer(THREE, canvasElement, parameters.resolution);
			previewResolution = parameters.resolution;
			previewInitialData = null;
			previewKey = '';
		}
	});

	$effect(() => {
		if (!isReady || !previewRenderer || !initMapSource || !structuralKey) {
			previewInitialData = null;
			previewKey = '';
			return;
		}

		const version = ++loadVersion;
		isLoadingMap = true;
		errorMessage = '';

		void (async () => {
			try {
				const heightData = await loadInitMapHeightData(initMapSource, parameters);
				if (version !== loadVersion || !previewRenderer) return;
				previewInitialData = heightData;
				previewKey = structuralKey;
				previewRenderer.setInitialHeight(heightData);
				previewRenderer.render(parameters);
				exportInitialData = null;
				exportKey = '';
				exportFrame = -1;
			} catch (error) {
				if (version !== loadVersion) return;
				errorMessage = error instanceof Error ? error.message : 'Failed to read init map.';
			} finally {
				if (version === loadVersion) {
					isLoadingMap = false;
				}
			}
		})();
	});

	async function renderExportFrame(canvas: HTMLCanvasElement, frameIndex: number) {
		const context = canvas.getContext('2d');
		if (!context) {
			throw new Error('Failed to acquire 2D export context.');
		}
		context.imageSmoothingEnabled = false;

		if (!THREE || !initMapSource || !structuralKey) {
			context.clearRect(0, 0, canvas.width, canvas.height);
			return;
		}

		if (!exportInitialData || exportKey !== structuralKey) {
			exportInitialData =
				previewKey === structuralKey && previewInitialData
					? previewInitialData
					: await loadInitMapHeightData(initMapSource, parameters);
			exportKey = structuralKey;
			exportFrame = -1;
			exportRenderer?.dispose();
			exportRenderer = null;
			exportRenderCanvas = null;
		}

		if (
			!exportRenderer ||
			!exportRenderCanvas ||
			exportResolution !== parameters.resolution ||
			frameIndex === 0 ||
			frameIndex < exportFrame
		) {
			exportRenderer?.dispose();
			exportRenderCanvas = document.createElement('canvas');
			exportRenderCanvas.width = parameters.resolution;
			exportRenderCanvas.height = parameters.resolution;
			exportRenderer = new ShallowWaterWaveRenderer(THREE, exportRenderCanvas, parameters.resolution);
			exportResolution = parameters.resolution;
			exportRenderer.setInitialHeight(exportInitialData);
			exportFrame = 0;
		}

		if (frameIndex > exportFrame) {
			exportRenderer.advanceFrames(frameIndex - exportFrame, parameters);
			exportFrame = frameIndex;
		}

		exportRenderer.render(parameters);
		context.clearRect(0, 0, canvas.width, canvas.height);
		context.drawImage(exportRenderCanvas, 0, 0, canvas.width, canvas.height);
	}

	onMount(() => {
		let disposed = false;
		let animationFrame = 0;
		let unregisterExporter: (() => void) | undefined;

		void (async () => {
			try {
				THREE = await loadTechStack('three');
				if (disposed || !canvasElement) return;

				previewRenderer = new ShallowWaterWaveRenderer(THREE, canvasElement, parameters.resolution);
				previewResolution = parameters.resolution;

				unregisterExporter = exportContext?.register({
					kind: 'render',
					get contentWidth() {
						return parameters.resolution;
					},
					get contentHeight() {
						return parameters.resolution;
					},
					renderFrame: async ({ canvas, frameIndex }) => {
						await renderExportFrame(canvas, frameIndex);
					},
					capabilities: {
						png: false,
						mp4: true
					}
				});

				isReady = true;
			} catch (error) {
				errorMessage = error instanceof Error ? error.message : 'Failed to initialize Three preview.';
			}
		})();

		function animate() {
			if (disposed) return;
			if (isSessionActive && previewRenderer && previewInitialData) {
				previewRenderer.advanceFrames(1, parameters);
				previewRenderer.render(parameters);
			}
			animationFrame = requestAnimationFrame(animate);
		}

		animationFrame = requestAnimationFrame(animate);

		return () => {
			disposed = true;
			cancelAnimationFrame(animationFrame);
			unregisterExporter?.();
			previewRenderer?.dispose();
			exportRenderer?.dispose();
			previewRenderer = null;
			exportRenderer = null;
			exportRenderCanvas = null;
			previewInitialData = null;
			exportInitialData = null;
		};
	});
</script>

<div class="shallow-preview">
	<canvas class="shallow-preview__canvas" bind:this={canvasElement} width={parameters.resolution} height={parameters.resolution}></canvas>

	{#if !initMapSource}
		<div class="shallow-preview__overlay">
			<div class="shallow-preview__message">
				<strong>No init map</strong>
				<span>
					{sourceMode === 'image'
						? 'Drop a black-and-white image or switch to preset mode.'
						: 'Choose a preset or image source to seed the height field.'}
				</span>
			</div>
		</div>
	{:else if !isReady || isLoadingMap}
		<div class="shallow-preview__overlay">Preparing height field...</div>
	{/if}

	{#if errorMessage}
		<div class="shallow-preview__overlay shallow-preview__overlay--error">{errorMessage}</div>
	{/if}
</div>

<style>
	.shallow-preview {
		position: relative;
		width: 100%;
		height: 100%;
		background: #05070b;
	}

	.shallow-preview__canvas {
		display: block;
		width: 100%;
		height: 100%;
		image-rendering: pixelated;
	}

	.shallow-preview__overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-5);
		background: rgba(5, 7, 11, 0.78);
		color: var(--color-fg-secondary);
		font-size: var(--font-size-2);
		line-height: var(--line-height-base);
		text-align: center;
	}

	.shallow-preview__message {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		max-width: 280px;
	}

	.shallow-preview__message strong {
		color: var(--color-fg-primary);
		font-size: var(--font-size-4);
		font-weight: 600;
	}

	.shallow-preview__overlay--error {
		color: var(--color-danger);
	}
</style>