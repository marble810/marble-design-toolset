<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		clampPreviewCanvasZoom,
		computePreviewCanvasFitZoom,
		computePreviewCanvasRenderScale,
		resolvePreviewCanvasDefaultMode
	} from './zoom.js';
	import type { PreviewCanvasFooterInfo } from './footer-info.js';
	import PreviewCanvasFooter from './PreviewCanvasFooter.svelte';

	interface Props {
		/** Logical preview content width in px before PreviewCanvas applies zoom. */
		contentWidth: number;
		/** Logical preview content height in px before PreviewCanvas applies zoom. */
		contentHeight: number;
		/** Optional toolbar label shown on the left side of the PreviewCanvas header. */
		label?: string;
		/** Initial zoom mode when the preview opens. Defaults to `Fit`. */
		defaultZoom?: 'Fit' | '1:1';
		/** Optional toolbar controls rendered after the built-in zoom actions. */
		actions?: Snippet;
		/** Optional footer info rendered outside the canvas frame and anchored to its bottom-right corner. */
		footerInfo?: PreviewCanvasFooterInfo | null;
		/** Preview content rendered inside the zoomable stage. */
		children?: Snippet;
	}

	let {
		contentWidth,
		contentHeight,
		label = '',
		defaultZoom = 'Fit',
		actions,
		footerInfo = null,
		children
	}: Props = $props();

	let viewportElement = $state<HTMLDivElement | null>(null);
	let viewportWidth = $state(0);
	let viewportHeight = $state(0);
	let devicePixelRatio = $state(1);
	let initialMode = $derived<'fit' | 'manual'>(resolvePreviewCanvasDefaultMode(defaultZoom));
	let mode = $state<'fit' | 'manual'>('fit');
	let manualZoom = $state(1);
	let panX = $state(0);
	let panY = $state(0);
	let isPanning = $state(false);
	let dragStartX = $state(0);
	let dragStartY = $state(0);
	let dragOriginX = $state(0);
	let dragOriginY = $state(0);
	let hasInitializedMode = $state(false);

	$effect.pre(() => {
		if (hasInitializedMode) {
			return;
		}

		mode = initialMode;
		hasInitializedMode = true;
	});

	$effect(() => {
		if (!viewportElement || typeof window === 'undefined') {
			return;
		}

		const updateViewport = (rect?: DOMRectReadOnly) => {
			if (rect) {
				viewportWidth = rect.width;
				viewportHeight = rect.height;
				return;
			}

			viewportWidth = viewportElement.clientWidth;
			viewportHeight = viewportElement.clientHeight;
		};

		const updateDevicePixelRatio = () => {
			devicePixelRatio = window.devicePixelRatio || 1;
		};

		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				updateViewport(entry.contentRect);
			}
		});

		const handleViewportChange = () => {
			updateDevicePixelRatio();
			updateViewport();
		};

		let resolutionQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
		const handleResolutionChange = () => {
			updateDevicePixelRatio();
			updateViewport();
			resolutionQuery.removeEventListener('change', handleResolutionChange);
			resolutionQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
			resolutionQuery.addEventListener('change', handleResolutionChange);
		};

		updateDevicePixelRatio();
		updateViewport();
		resizeObserver.observe(viewportElement);
		window.addEventListener('resize', handleViewportChange);
		window.visualViewport?.addEventListener('resize', handleViewportChange);
		resolutionQuery.addEventListener('change', handleResolutionChange);

		return () => {
			resizeObserver.disconnect();
			window.removeEventListener('resize', handleViewportChange);
			window.visualViewport?.removeEventListener('resize', handleViewportChange);
			resolutionQuery.removeEventListener('change', handleResolutionChange);
		};
	});

	let fitZoom = $derived.by(() =>
		computePreviewCanvasFitZoom({
			viewportWidth,
			viewportHeight,
			contentWidth,
			contentHeight,
			devicePixelRatio,
			padding: 72
		})
	);

	let resolvedZoom = $derived(mode === 'fit' ? fitZoom : manualZoom);
	let renderScale = $derived(computePreviewCanvasRenderScale(resolvedZoom, devicePixelRatio));
	let zoomPercent = $derived(Math.round(resolvedZoom * 100));
	const footerScaleFactor = 1.8;
	const footerMinScale = 0.75;
	const footerMaxScale = 2.5;
	let footerRenderScale = $derived(
		Math.min(footerMaxScale, Math.max(footerMinScale, renderScale * footerScaleFactor))
	);
	const footerAnchorOffsetX = 1;
	let footerAnchorX = $derived(panX + (contentWidth * renderScale) / 2 + footerAnchorOffsetX);
	let footerAnchorY = $derived(panY + (contentHeight * renderScale) / 2);

	function resetPan() {
		panX = 0;
		panY = 0;
	}

	function setFit() {
		mode = 'fit';
		resetPan();
	}

	function setActualSize() {
		mode = 'manual';
		manualZoom = 1;
		resetPan();
	}

	function nudgeZoom(multiplier: number) {
		const baseZoom = mode === 'fit' ? fitZoom : manualZoom;
		mode = 'manual';
		manualZoom = clampPreviewCanvasZoom(baseZoom * multiplier);
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

	<div class="preview-canvas__surface">
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
				<div class="preview-canvas__anchor">
					<div
						class="preview-canvas__content"
						style={`width:${contentWidth}px;height:${contentHeight}px;left:${-contentWidth / 2}px;top:${-contentHeight / 2}px;transform: translate(${panX}px, ${panY}px) scale(${renderScale});`}
					>
						{@render children?.()}
					</div>

					<PreviewCanvasFooter
						footerInfo={footerInfo}
						anchorX={footerAnchorX}
						anchorY={footerAnchorY}
						renderScale={footerRenderScale}
					/>
				</div>
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
		margin-left: 1em;
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

	.preview-canvas__surface {
		display: flex;
		flex: 1 1 auto;
		flex-direction: column;
		min-height: 0;
	}

	.preview-canvas__viewport {
		position: relative;
		flex: 1 1 auto;
		min-height: 0;
		overflow: hidden;
		touch-action: none;
		cursor: grab;
		user-select: none;
		-webkit-user-select: none;
	}

	.preview-canvas__viewport:active {
		cursor: grabbing;
	}

	.preview-canvas__center {
		position: relative;
		width: 100%;
		height: 100%;
		padding: var(--space-6);
	}

	.preview-canvas__anchor {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 0;
		height: 0;
	}

	.preview-canvas__content {
		position: absolute;
		background: var(--color-bg-inset);
		transform-origin: center center;
		will-change: transform;
		user-select: none;
		-webkit-user-select: none;
	}

	.preview-canvas__content :global(*) {
		user-select: none;
		-webkit-user-select: none;
	}

	.preview-canvas__content::after {
		content: '';
		position: absolute;
		inset: 0;
		border: var(--border-width-outer) solid var(--color-border-strong);
		box-shadow: inset 0 0 0 var(--border-width-inner) var(--color-border-soft);
		pointer-events: none;
	}

	.preview-canvas__content :global(canvas),
	.preview-canvas__content :global(img) {
		display: block;
		image-rendering: crisp-edges;
		image-rendering: pixelated;
	}
</style>