<script lang="ts">
	import { onMount } from 'svelte';
	import {
		createCanvas2DRenderHost,
		createPixiApplicationHost,
		createRenderHostLifecycle
	} from '$lib/runtime/render-host/index.js';
	import type { Pixels16Buffer } from '$lib/types/canvas-export';
	import type { Application, Sprite, Texture } from 'pixi.js';
	import { generateNoiseTexture } from '../noise/controller.js';
	import {
		PREVIEW_SIZE,
		type NoiseFamily,
		type PerlinNoiseParameters,
		type SharedNoiseParameters,
		type VoronoiNoiseParameters
	} from '../noise/shared.js';

	interface Props {
		activeFamily: NoiseFamily;
		shared: SharedNoiseParameters;
		perlin: PerlinNoiseParameters;
		voronoi: VoronoiNoiseParameters;
	}

	let { activeFamily, shared, perlin, voronoi }: Props = $props();

	const renderHost = createRenderHostLifecycle();

	let hostElement = $state<HTMLDivElement | null>(null);
	const isReady = $derived(renderHost.isReady);
	const errorMessage = $derived(renderHost.errorMessage);
	const isSessionActive = $derived(renderHost.isSessionActive);

	let pixiApp: Application | null = null;
	let previewTexture: Texture | null = null;
	let previewSprite: Sprite | null = null;
	let sourceCanvas: HTMLCanvasElement | null = null;
	let sourceContext: CanvasRenderingContext2D | null = null;
	let latestPixels16: Pixels16Buffer | null = null;

	function renderPreview() {
		if (!sourceCanvas || !sourceContext || !previewTexture) {
			return;
		}

		const result = generateNoiseTexture(
			{
				activeFamily,
				shared,
				perlin,
				voronoi
			},
			PREVIEW_SIZE
		);

		sourceContext.putImageData(
			new ImageData(Uint8ClampedArray.from(result.rgba8), result.width, result.height),
			0,
			0
		);
		previewTexture.source.update();
		latestPixels16 = {
			data: result.rgba16,
			width: result.width,
			height: result.height,
			channels: 4
		};
		pixiApp?.render();
	}

	$effect(() => {
		activeFamily;
		shared;
		perlin;
		voronoi;
		isSessionActive;

		if (isReady && isSessionActive) {
			renderPreview();
		}
	});

	onMount(() => {
		void renderHost.runInit(async () => {
			if (!hostElement) {
				throw new Error('Preview host is unavailable.');
			}

			const sourceHost = createCanvas2DRenderHost(renderHost, {
				width: PREVIEW_SIZE,
				height: PREVIEW_SIZE,
				willReadFrequently: true
			});
			sourceCanvas = sourceHost.canvas;
			sourceContext = sourceHost.context;

			const pixiHost = await createPixiApplicationHost(renderHost, {
				hostElement,
				init: {
					width: PREVIEW_SIZE,
					height: PREVIEW_SIZE,
					backgroundAlpha: 0,
					resolution: 1,
					autoDensity: false,
					antialias: false,
					autoStart: false
				}
			});

			const PIXI = pixiHost.PIXI;
			pixiApp = pixiHost.app;
			previewTexture = PIXI.Texture.from(sourceCanvas);
			previewSprite = new PIXI.Sprite(previewTexture);
			previewSprite.width = PREVIEW_SIZE;
			previewSprite.height = PREVIEW_SIZE;
			pixiApp.stage.addChild(previewSprite);

			renderHost.registerCanvasExporter(
				{
					kind: 'canvas',
					get contentWidth() {
						return PREVIEW_SIZE;
					},
					get contentHeight() {
						return PREVIEW_SIZE;
					},
					getCanvas: () => sourceCanvas,
					getPixels16: () => latestPixels16,
					capabilities: {
						png: true,
						mp4: false,
						pngBitDepth: 16
					}
				},
				{ id: 'height-map', label: 'Height Map' }
			);

			renderHost.addCleanup(() => {
				pixiApp = null;
				previewTexture = null;
				previewSprite = null;
				sourceCanvas = null;
				sourceContext = null;
				latestPixels16 = null;
			});

			renderPreview();
		}, 'Failed to initialize Pixi preview.');
	});
</script>

<div class="noise-preview">
	<div class="noise-preview__stage" bind:this={hostElement}></div>

	{#if !isReady && !errorMessage}
		<div class="noise-preview__overlay">Booting Pixi preview...</div>
	{/if}

	{#if errorMessage}
		<div class="noise-preview__overlay noise-preview__overlay--error">{errorMessage}</div>
	{/if}
</div>

<style>
	.noise-preview {
		position: relative;
		width: 100%;
		height: 100%;
		background:
			radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.05), transparent 28%),
			linear-gradient(180deg, rgba(10, 14, 24, 0.18), rgba(10, 14, 24, 0.36));
	}

	.noise-preview__stage {
		display: flex;
		width: 100%;
		height: 100%;
	}

	.noise-preview__overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-5);
		background: rgba(6, 9, 15, 0.76);
		color: var(--color-fg-secondary);
		font-size: var(--font-size-2);
		text-align: center;
	}

	.noise-preview__overlay--error {
		color: var(--color-danger);
	}
</style>