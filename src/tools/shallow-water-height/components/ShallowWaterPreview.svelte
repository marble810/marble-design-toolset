<script lang="ts">
	import { onMount } from 'svelte';
	import {
		createRenderHostLifecycle,
		createThreeRenderHost
	} from '$lib/runtime/render-host/index.js';
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

	const renderHost = createRenderHostLifecycle();

	let canvasElement = $state<HTMLCanvasElement | null>(null);
	const isReady = $derived(renderHost.isReady);
	let isLoadingMap = $state(false);
	let loadErrorMessage = $state('');
	const errorMessage = $derived(renderHost.errorMessage || loadErrorMessage);

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
		loadErrorMessage = '';

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
				loadErrorMessage = error instanceof Error ? error.message : 'Failed to read init map.';
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
		void renderHost.runInit(async () => {
			const threeHost = await createThreeRenderHost(renderHost);
			if (renderHost.isDisposed) return;
			if (!canvasElement) {
				throw new Error('Preview canvas is unavailable.');
			}

			THREE = threeHost.THREE;
			previewRenderer = new ShallowWaterWaveRenderer(THREE, canvasElement, parameters.resolution);
			previewResolution = parameters.resolution;

			renderHost.registerRenderExporter(
				{
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
						png: true,
						mp4: true
					}
				},
				{ id: 'simulation-video', label: 'Simulation Video' }
			);

			renderHost.addCleanup(() => {
				previewRenderer?.dispose();
				exportRenderer?.dispose();
				previewRenderer = null;
				exportRenderer = null;
				exportRenderCanvas = null;
				previewInitialData = null;
				exportInitialData = null;
			});
		}, 'Failed to initialize Three preview.');

		renderHost.startAnimationLoop(() => {
			if (previewRenderer && previewInitialData) {
				previewRenderer.advanceFrames(1, parameters);
				previewRenderer.render(parameters);
			}
		});
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