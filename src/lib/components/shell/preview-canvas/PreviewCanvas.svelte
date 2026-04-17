<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';

	interface Props {
		contentWidth: number;
		contentHeight: number;
		label?: string;
		actions?: Snippet;
		children?: Snippet;
	}

	let { contentWidth, contentHeight, label = '', actions, children }: Props = $props();

	let viewportElement = $state<HTMLDivElement | null>(null);
	let viewportWidth = $state(0);
	let viewportHeight = $state(0);
	let mode = $state<'fit' | 'manual'>('fit');
	let manualScale = $state(1);
	let panX = $state(0);
	let panY = $state(0);
	let isPanning = $state(false);
	let dragStartX = $state(0);
	let dragStartY = $state(0);
	let dragOriginX = $state(0);
	let dragOriginY = $state(0);

	$effect(() => {
		if (!viewportElement) {
			return;
		}

		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				viewportWidth = entry.contentRect.width;
				viewportHeight = entry.contentRect.height;
			}
		});

		resizeObserver.observe(viewportElement);
		return () => resizeObserver.disconnect();
	});

	let fitScale = $derived.by(() => {
		if (!viewportWidth || !viewportHeight || !contentWidth || !contentHeight) {
			return 1;
		}

		const padding = 72;
		const availableWidth = Math.max(viewportWidth - padding, 1);
		const availableHeight = Math.max(viewportHeight - padding, 1);

		return Math.min(availableWidth / contentWidth, availableHeight / contentHeight);
	});

	let resolvedScale = $derived(mode === 'fit' ? fitScale : manualScale);
	let zoomPercent = $derived(Math.round(resolvedScale * 100));

	function clampScale(scale: number): number {
		return Math.min(16, Math.max(0.1, scale));
	}

	function setFit() {
		mode = 'fit';
		panX = 0;
		panY = 0;
	}

	function setActualSize() {
		mode = 'manual';
		manualScale = 1;
		panX = 0;
		panY = 0;
	}

	function nudgeZoom(multiplier: number) {
		const baseScale = mode === 'fit' ? fitScale : manualScale;
		mode = 'manual';
		manualScale = clampScale(baseScale * multiplier);
	}

	function handleWheel(event: WheelEvent) {
		event.preventDefault();
		nudgeZoom(event.deltaY < 0 ? 1.1 : 0.9);
	}

	function handlePointerDown(event: PointerEvent) {
		if (event.button !== 0 || !viewportElement) {
			return;
		}

		isPanning = true;
		dragStartX = event.clientX;
		dragStartY = event.clientY;
		dragOriginX = panX;
		dragOriginY = panY;
		viewportElement.setPointerCapture(event.pointerId);
	}

	function handlePointerMove(event: PointerEvent) {
		if (!isPanning) {
			return;
		}

		panX = dragOriginX + (event.clientX - dragStartX);
		panY = dragOriginY + (event.clientY - dragStartY);
	}

	function handlePointerEnd(event: PointerEvent) {
		if (!isPanning || !viewportElement) {
			return;
		}

		isPanning = false;
		viewportElement.releasePointerCapture(event.pointerId);
	}
</script>

<section class="preview-canvas">
	<div class="preview-canvas__toolbar">
		<div class="preview-canvas__meta">
			{#if label}
				<span class="preview-canvas__label">{label}</span>
			{/if}
			<span class="preview-canvas__zoom">{zoomPercent}%</span>
		</div>

		<div class="preview-canvas__controls">
			<Button variant="ghost" size="sm" onclick={setFit}>Fit</Button>
			<Button variant="ghost" size="sm" onclick={setActualSize}>1:1</Button>
			<Button variant="ghost" size="icon" aria-label="Zoom out" onclick={() => nudgeZoom(0.9)}>-</Button>
			<Button variant="ghost" size="icon" aria-label="Zoom in" onclick={() => nudgeZoom(1.1)}>+</Button>
			{#if actions}
				<span class="preview-canvas__separator"></span>
				{@render actions()}
			{/if}
		</div>
	</div>

	<div
		class="preview-canvas__viewport pixel-checkerboard"
		role="region"
		aria-label="Preview canvas"
		bind:this={viewportElement}
		onwheel={handleWheel}
		onpointerdown={handlePointerDown}
		onpointermove={handlePointerMove}
		onpointerup={handlePointerEnd}
		onpointercancel={handlePointerEnd}
	>
		<div class="preview-canvas__center">
			<div
				class="preview-canvas__content"
				style={`width:${contentWidth}px;height:${contentHeight}px;transform: translate(${panX}px, ${panY}px) scale(${resolvedScale});`}
			>
				{@render children?.()}
			</div>
		</div>
	</div>
</section>

<style>
	.preview-canvas {
		display: flex;
		flex: 1 1 auto;
		flex-direction: column;
		min-width: 0;
		min-height: 0;
		background: var(--color-bg-panel);
	}

	.preview-canvas__toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		padding: var(--space-1);
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	.preview-canvas__meta {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-width: 0;
	}

	.preview-canvas__label {
		color: var(--color-fg-secondary);
		font-size: var(--font-size-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.preview-canvas__zoom {
		color: var(--color-fg-muted);
		font-size: var(--font-size-1);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.preview-canvas__controls {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}

	.preview-canvas__separator {
		width: 1px;
		height: 16px;
		margin: 0 var(--space-2);
		background: rgba(255, 255, 255, 0.08);
	}

	.preview-canvas__viewport {
		position: relative;
		flex: 1 1 auto;
		min-height: 0;
		overflow: hidden;
		touch-action: none;
		cursor: grab;
	}

	.preview-canvas__viewport:active {
		cursor: grabbing;
	}

	.preview-canvas__center {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		padding: var(--space-6);
	}

	.preview-canvas__content {
		position: relative;
		transform-origin: center center;
		will-change: transform;
	}
</style>