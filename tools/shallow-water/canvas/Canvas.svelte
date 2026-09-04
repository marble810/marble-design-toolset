<script lang="ts">
	/**
	 * Shallow Water Visual Tool Surface — runs INSIDE the Tool Container realm. The
	 * per-session simulation runtime (WebGL ping-pong renderer, rAF loop, init-map
	 * decoding) is created here and published to the Tool Entry callbacks through the
	 * realm-scoped holder; nothing crosses the Environment API except Parameter changes.
	 */
	import { onMount } from 'svelte';
	import type { ContainerSurfaceContext } from '@deshelf/tool-sdk';
	import { createShallowWaterRuntime, type RuntimeStatus } from '../sim/runtime.ts';
	import { bindSessionRuntime } from '../sim/session.ts';

	let { context }: { context: ContainerSurfaceContext } = $props();

	let canvasElement: HTMLCanvasElement | undefined = $state();
	let status = $state<RuntimeStatus>({ kind: 'loading' });
	let surface = $state(context.surface());
	let surfaceWidth = $derived(`${Math.max(1, Math.round(surface.width))}px`);
	let surfaceHeight = $derived(`${Math.max(1, Math.round(surface.height))}px`);
	let canvasSize = $derived(`${Math.max(1, Math.round(Math.min(surface.width, surface.height)))}px`);

	onMount(() => {
		const runtime = createShallowWaterRuntime(context);
		bindSessionRuntime(runtime);
		const detachStatus = runtime.subscribeStatus((next) => {
			status = next;
		});
		const detachSurface = context.onSurface((next) => {
			surface = next;
		});
		if (canvasElement !== undefined) runtime.attach(canvasElement);

		return () => {
			detachStatus();
			detachSurface();
			bindSessionRuntime(null);
			runtime.dispose();
		};
	});
</script>

<div class="shallow-canvas" style:width={surfaceWidth} style:height={surfaceHeight}>
	<canvas class="shallow-canvas__surface" style:width={canvasSize} style:height={canvasSize} bind:this={canvasElement}></canvas>

	{#if status.kind === 'loading'}
		<div class="shallow-canvas__overlay">Preparing height field...</div>
	{:else if status.kind === 'idle'}
		<div class="shallow-canvas__overlay">
			<div class="shallow-canvas__message">
				<strong>No init map</strong>
				<span>{status.message}</span>
			</div>
		</div>
	{:else if status.kind === 'error'}
		<div class="shallow-canvas__overlay shallow-canvas__overlay--error">{status.message}</div>
	{/if}
</div>

<style>
	.shallow-canvas {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--shallow-water-canvas-bg, #05070b);
	}

	.shallow-canvas__surface {
		image-rendering: pixelated;
	}

	.shallow-canvas__overlay {
		position: absolute;
		inset: 0px;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
		background: var(--shallow-water-overlay-bg, rgba(5, 7, 11, 0.78));
		color: var(--color-fg-secondary, #9aa4b2);
		font-size: 13px;
		line-height: 20px;
		text-align: center;
	}

	.shallow-canvas__message {
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-width: 280px;
	}

	.shallow-canvas__message strong {
		color: var(--color-fg-primary, #e8ecf1);
		font-size: 16px;
		font-weight: 600;
	}

	.shallow-canvas__overlay--error {
		color: var(--color-danger, #ff7a7a);
	}
</style>
