<script lang="ts">
	import { onMount } from 'svelte';
	import { getCanvasExportContext } from '$lib/runtime/canvas-export/index';

	interface Props {
		width: number;
		height: number;
		seed?: number;
	}

	let { width, height, seed = 1337 }: Props = $props();

	let liveCanvas = $state<HTMLCanvasElement | null>(null);

	function pseudoRandom(x: number, y: number, s: number): number {
		const v = Math.sin(x * 12.9898 + y * 78.233 + s * 0.123) * 43758.5453;
		return v - Math.floor(v);
	}

	function paintNoise(target: HTMLCanvasElement, w: number, h: number, s: number) {
		const ctx = target.getContext('2d');
		if (!ctx) return;
		target.width = w;
		target.height = h;
		const image = ctx.createImageData(w, h);
		const data = image.data;
		for (let y = 0; y < h; y += 1) {
			for (let x = 0; x < w; x += 1) {
				const value = Math.floor(pseudoRandom(x, y, s) * 256);
				const offset = (y * w + x) * 4;
				data[offset] = value;
				data[offset + 1] = value;
				data[offset + 2] = value;
				data[offset + 3] = 255;
			}
		}
		ctx.putImageData(image, 0, 0);
	}

	$effect(() => {
		if (!liveCanvas) return;
		paintNoise(liveCanvas, width, height, seed);
	});

	// Read during component initialization to satisfy Svelte 5 getContext rule.
	const exportContext = getCanvasExportContext();

	onMount(() => {
		if (!exportContext) return;

		const unregister = exportContext.register({
			kind: 'render',
			get contentWidth() {
				return width;
			},
			get contentHeight() {
				return height;
			},
			renderFrame: ({ canvas, time }) => {
				// Time-shifted seed so MP4 frames vary visibly.
				paintNoise(canvas, canvas.width, canvas.height, seed + time * 0.05);
			}
		});

		return () => unregister();
	});
</script>

<canvas bind:this={liveCanvas} class="noise-preview" style={`width:${width}px;height:${height}px;`}></canvas>

<style>
	.noise-preview {
		display: block;
		image-rendering: pixelated;
	}
</style>
