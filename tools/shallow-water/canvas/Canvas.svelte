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

	onMount(() => {
		const runtime = createShallowWaterRuntime(context);
		bindSessionRuntime(runtime);
		const detachStatus = runtime.subscribeStatus((next) => {
			status = next;
		});
		if (canvasElement !== undefined) runtime.attach(canvasElement);

		return () => {
			detachStatus();
			bindSessionRuntime(null);
			runtime.dispose();
		};
	});
</script>

<div class="shallow-canvas">
	<canvas class="shallow-canvas__surface" bind:this={canvasElement}></canvas>

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
		width: 100%;
		height: 100%;
		background: #05070b;
	}

	.shallow-canvas__surface {
		max-width: 100%;
		max-height: 100%;
		aspect-ratio: 1 / 1;
		image-rendering: pixelated;
	}

	.shallow-canvas__overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
		background: rgba(5, 7, 11, 0.78);
		color: var(--color-fg-secondary, #9aa4b2);
		font-size: 13px;
		line-height: 1.5;
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
