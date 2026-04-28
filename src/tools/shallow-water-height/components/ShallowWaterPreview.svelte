<script lang="ts">
	import { onMount } from 'svelte';
	import { getCanvasExportContext } from '$lib/runtime/canvas-export/context';
	import { getToolSessionContext } from '$lib/runtime/tool-session-context';
	import { loadTechStack } from '$lib/runtime/tech-stack';
	import type { ImportedImageFileItem } from '$lib/types/file-input';
	import { OUTPUT_SIZE, type ShallowWaterParameters } from '../simulation/shared.js';
	import { loadImageHeightData } from '../simulation/image-height.js';
	import { ShallowWaterWaveRenderer } from '../simulation/wave-renderer.js';

	type ThreeModule = typeof import('three');

	interface Props {
		imageItem: ImportedImageFileItem | null;
		parameters: ShallowWaterParameters;
	}

	let { imageItem, parameters }: Props = $props();

	const exportContext = getCanvasExportContext();
	const toolSessionContext = getToolSessionContext();

	let canvasElement = $state<HTMLCanvasElement | null>(null);
	let isReady = $state(false);
	let isLoadingMap = $state(false);
	let errorMessage = $state('');
	let isSessionActive = $derived(toolSessionContext?.isActive() ?? true);

	let THREE: ThreeModule | null = null;
	let previewRenderer: ShallowWaterWaveRenderer | null = null;
	let previewInitialData: Float32Array | null = null;
	let previewKey = '';
	let loadVersion = 0;

	let exportRenderer: ShallowWaterWaveRenderer | null = null;
	let exportCanvas: HTMLCanvasElement | null = null;
	let exportInitialData: Float32Array | null = null;
	let exportKey = '';
	let exportFrame = -1;

	const structuralKey = $derived(
		imageItem
			? [imageItem.objectUrl, parameters.resolution, parameters.amplitude, parameters.invert].join('|')
			: ''
	);

	$effect(() => {
		if (!isReady || !previewRenderer || !imageItem || !structuralKey) {
			previewInitialData = null;
			previewKey = '';
			return;
		}

		const version = ++loadVersion;
		isLoadingMap = true;
		errorMessage = '';

		void (async () => {
			try {
				const heightData = await loadImageHeightData(imageItem.objectUrl, parameters);
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
		if (!THREE || !imageItem || !structuralKey) {
			context?.clearRect(0, 0, canvas.width, canvas.height);
			return;
		}

		if (!exportInitialData || exportKey !== structuralKey) {
			exportInitialData =
				previewKey === structuralKey && previewInitialData
					? previewInitialData
					: await loadImageHeightData(imageItem.objectUrl, parameters);
			exportKey = structuralKey;
			exportFrame = -1;
		}

		if (
			!exportRenderer ||
			exportCanvas !== canvas ||
			canvas.width !== exportRenderer.canvas.width ||
			canvas.height !== exportRenderer.canvas.height ||
			frameIndex === 0 ||
			frameIndex < exportFrame
		) {
			exportRenderer?.dispose();
			exportRenderer = new ShallowWaterWaveRenderer(THREE, canvas, parameters.resolution);
			exportCanvas = canvas;
			exportRenderer.setInitialHeight(exportInitialData);
			exportFrame = 0;
		}

		if (frameIndex > exportFrame) {
			exportRenderer.advanceFrames(frameIndex - exportFrame, parameters);
			exportFrame = frameIndex;
		}

		exportRenderer.render(parameters);
	}

	onMount(() => {
		let disposed = false;
		let animationFrame = 0;
		let unregisterExporter: (() => void) | undefined;

		void (async () => {
			try {
				THREE = await loadTechStack('three');
				if (disposed || !canvasElement) return;

				canvasElement.width = OUTPUT_SIZE;
				canvasElement.height = OUTPUT_SIZE;
				previewRenderer = new ShallowWaterWaveRenderer(THREE, canvasElement, parameters.resolution);

				unregisterExporter = exportContext?.register({
					kind: 'render',
					get contentWidth() {
						return OUTPUT_SIZE;
					},
					get contentHeight() {
						return OUTPUT_SIZE;
					},
					renderFrame: async ({ canvas, frameIndex }) => {
						await renderExportFrame(canvas, frameIndex);
					},
					capabilities: {
						png: true,
						mp4: true,
						pngBitDepth: 8
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
			exportCanvas = null;
			previewInitialData = null;
			exportInitialData = null;
		};
	});
</script>

<div class="shallow-preview">
	<canvas class="shallow-preview__canvas" bind:this={canvasElement} width={OUTPUT_SIZE} height={OUTPUT_SIZE}></canvas>

	{#if !imageItem}
		<div class="shallow-preview__overlay">
			<div class="shallow-preview__message">
				<strong>Drop init map</strong>
				<span>Use a black-and-white image to seed the height field.</span>
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