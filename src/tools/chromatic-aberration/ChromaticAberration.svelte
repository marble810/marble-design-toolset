<script lang="ts">
	import { onDestroy } from 'svelte';
	import { LeftPanel, RightPanel, PreviewCanvas, Section } from '$lib/components/shell/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { SliderField } from '$lib/components/ui/slider-field/index.js';
	import {
		createFileInputController,
		extractDroppedFiles
	} from '$lib/runtime/file-input/index.js';
	import AberrationCanvas from './components/AberrationCanvas.svelte';

	// ──────────────────────────────────────────────────────────────────────────
	// File input
	// ──────────────────────────────────────────────────────────────────────────
	const fileInput = createFileInputController({ allowedKinds: ['image', 'video'] });
	onDestroy(() => fileInput.dispose());

	const sourceItem = $derived(fileInput.currentItem);
	const objectUrl = $derived(
		sourceItem?.kind === 'image' || sourceItem?.kind === 'video'
			? sourceItem.objectUrl
			: null
	);
	const sourceKind = $derived<'image' | 'video' | null>(
		sourceItem?.kind === 'image' || sourceItem?.kind === 'video' ? sourceItem.kind : null
	);
	const sourceWidth = $derived(
		(sourceItem?.kind === 'image' || sourceItem?.kind === 'video') && sourceItem.width > 0
			? sourceItem.width
			: 800
	);
	const sourceHeight = $derived(
		(sourceItem?.kind === 'image' || sourceItem?.kind === 'video') && sourceItem.height > 0
			? sourceItem.height
			: 600
	);

	// Resolved dimensions: updated by AberrationCanvas when video's actual frame size
	// differs from metadata (e.g. videoWidth/videoHeight were 0 at loadedmetadata time)
	let resolvedWidth = $state(800);
	let resolvedHeight = $state(600);

	$effect(() => {
		resolvedWidth = sourceWidth;
		resolvedHeight = sourceHeight;
	});

	function handleResolvedSize(w: number, h: number) {
		resolvedWidth = w;
		resolvedHeight = h;
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Lens warp parameters
	// ──────────────────────────────────────────────────────────────────────────
	let warpCenterX = $state(0.5);
	let warpCenterY = $state(0.5);
	let warpDist = $state(0.0);

	// ──────────────────────────────────────────────────────────────────────────
	// Chromatic dispersion parameters
	// Per-channel radial factor: kChannel = warpDist + channelRadial * radialStrength
	// Red / Blue have opposite signs for natural lens CA (red bends less, blue more)
	// ──────────────────────────────────────────────────────────────────────────
	let radialStrength = $state(0.3);
	let redRadial = $state(-1.0);
	let greenRadial = $state(0.0);
	let blueRadial = $state(1.0);

	// ──────────────────────────────────────────────────────────────────────────
	// Linear channel offset parameters (pixels in source image space)
	// ──────────────────────────────────────────────────────────────────────────
	let redOffsetX = $state(0);
	let redOffsetY = $state(0);
	let greenOffsetX = $state(0);
	let greenOffsetY = $state(0);
	let blueOffsetX = $state(0);
	let blueOffsetY = $state(0);

	// ──────────────────────────────────────────────────────────────────────────
	// Output blend
	// ──────────────────────────────────────────────────────────────────────────
	let intensity = $state(1.0);

	// ──────────────────────────────────────────────────────────────────────────
	// Drop-zone state
	// ──────────────────────────────────────────────────────────────────────────
	let isDragOver = $state(false);

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragOver = true;
	}

	function handleDragLeave(event: DragEvent) {
		// Only clear when leaving the outer drop zone, not an inner child
		const target = event.relatedTarget as Node | null;
		const current = event.currentTarget as HTMLElement;
		if (!target || !current.contains(target)) {
			isDragOver = false;
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragOver = false;
		void fileInput.ingestFiles(extractDroppedFiles(event), 'drop');
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Helpers
	// ──────────────────────────────────────────────────────────────────────────
	function resetAll() {
		warpCenterX = 0.5;
		warpCenterY = 0.5;
		warpDist = 0.0;
		radialStrength = 0.3;
		redRadial = -1.0;
		greenRadial = 0.0;
		blueRadial = 1.0;
		redOffsetX = 0;
		redOffsetY = 0;
		greenOffsetX = 0;
		greenOffsetY = 0;
		blueOffsetX = 0;
		blueOffsetY = 0;
		intensity = 1.0;
	}
</script>

<LeftPanel>
	<!-- ── Source ───────────────────────────────────────────────────────────── -->
	<Section title="Source">
		<div class="ca__source">
			{#if sourceItem}
				<div class="ca__source-info">
					<span class="ca__source-name">{sourceItem.name}</span>
					<span class="ca__source-meta">{sourceWidth} × {sourceHeight} px</span>
				</div>
				<div class="ca__source-actions">
					<Button variant="ghost" size="sm" onclick={() => void fileInput.pick()}>Replace</Button>
					<Button variant="ghost" size="sm" onclick={() => fileInput.clear()}>Clear</Button>
				</div>
			{:else}
				<p class="ca__source-hint">
					Drop an image or video onto the preview, or browse to load one.
				</p>
				<Button variant="outline" size="sm" onclick={() => void fileInput.pick()}>Browse…</Button>
			{/if}
			{#if fileInput.lastError}
				<p class="ca__source-error">{fileInput.lastError.message}</p>
			{/if}
		</div>
	</Section>

	<!-- ── Lens Warp ────────────────────────────────────────────────────────── -->
	<Section title="Lens Warp">
		<div class="ca__controls">
			<SliderField
				label="Warp Dist"
				min={-1.5}
				max={2.0}
				step={0.01}
				value={warpDist}
				onchange={(v) => (warpDist = v)}
			/>
			<SliderField
				label="Center X"
				min={0}
				max={1}
				step={0.01}
				value={warpCenterX}
				onchange={(v) => (warpCenterX = v)}
			/>
			<SliderField
				label="Center Y"
				min={0}
				max={1}
				step={0.01}
				value={warpCenterY}
				onchange={(v) => (warpCenterY = v)}
			/>
		</div>
	</Section>

	<!-- ── Chromatic Dispersion ─────────────────────────────────────────────── -->
	<Section title="Chromatic Dispersion">
		<div class="ca__controls">
			<SliderField
				label="Strength"
				min={0}
				max={1.5}
				step={0.01}
				value={radialStrength}
				onchange={(v) => (radialStrength = v)}
			/>
			<SliderField
				label="Red Channel"
				min={-2}
				max={2}
				step={0.01}
				value={redRadial}
				onchange={(v) => (redRadial = v)}
			/>
			<SliderField
				label="Green Channel"
				min={-2}
				max={2}
				step={0.01}
				value={greenRadial}
				onchange={(v) => (greenRadial = v)}
			/>
			<SliderField
				label="Blue Channel"
				min={-2}
				max={2}
				step={0.01}
				value={blueRadial}
				onchange={(v) => (blueRadial = v)}
			/>
		</div>
	</Section>

	<!-- ── Channel Offsets ──────────────────────────────────────────────────── -->
	<Section title="Channel Offsets" collapsible>
		<div class="ca__controls">
			<p class="ca__offset-group-label">Red</p>
			<SliderField
				label="Red X"
				min={-100}
				max={100}
				step={0.5}
				value={redOffsetX}
				onchange={(v) => (redOffsetX = v)}
			/>
			<SliderField
				label="Red Y"
				min={-100}
				max={100}
				step={0.5}
				value={redOffsetY}
				onchange={(v) => (redOffsetY = v)}
			/>
			<p class="ca__offset-group-label">Green</p>
			<SliderField
				label="Green X"
				min={-100}
				max={100}
				step={0.5}
				value={greenOffsetX}
				onchange={(v) => (greenOffsetX = v)}
			/>
			<SliderField
				label="Green Y"
				min={-100}
				max={100}
				step={0.5}
				value={greenOffsetY}
				onchange={(v) => (greenOffsetY = v)}
			/>
			<p class="ca__offset-group-label">Blue</p>
			<SliderField
				label="Blue X"
				min={-100}
				max={100}
				step={0.5}
				value={blueOffsetX}
				onchange={(v) => (blueOffsetX = v)}
			/>
			<SliderField
				label="Blue Y"
				min={-100}
				max={100}
				step={0.5}
				value={blueOffsetY}
				onchange={(v) => (blueOffsetY = v)}
			/>
		</div>
	</Section>

	<!-- ── Output ────────────────────────────────────────────────────────────── -->
	<Section title="Output">
		<div class="ca__controls">
			<SliderField
				label="Intensity"
				min={0}
				max={1}
				step={0.01}
				value={intensity}
				onchange={(v) => (intensity = v)}
			/>
		</div>
		<div class="ca__reset-row">
			<Button variant="ghost" size="sm" onclick={resetAll}>Reset All</Button>
		</div>
	</Section>
</LeftPanel>

<RightPanel>
	<!-- Drop zone covers the whole right area -->
	<div
		class="ca__drop-zone"
		class:ca__drop-zone--active={isDragOver}
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		ondrop={handleDrop}
		role="region"
		aria-label="Drop image or video to load"
	>
		<PreviewCanvas
			contentWidth={resolvedWidth}
			contentHeight={resolvedHeight}
			defaultZoom="Fit"
			label="Chromatic Aberration"
		>
			<AberrationCanvas
				{objectUrl}
				{sourceKind}
				{sourceWidth}
				{sourceHeight}
				{warpCenterX}
				{warpCenterY}
				{warpDist}
				{radialStrength}
				{redRadial}
				{greenRadial}
				{blueRadial}
				{redOffsetX}
				{redOffsetY}
				{greenOffsetX}
				{greenOffsetY}
				{blueOffsetX}
				{blueOffsetY}
				mix={intensity}
				onResolvedSize={handleResolvedSize}
			/>
		</PreviewCanvas>
	</div>
</RightPanel>

<style>
	/* ── Source section ───────────────────────────────────────────────────── */
	.ca__source {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-1) 0;
	}

	.ca__source-info {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.ca__source-name {
		font-size: var(--font-size-1);
		color: var(--color-fg-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.ca__source-meta {
		font-size: var(--font-size-0);
		color: var(--color-fg-muted);
	}

	.ca__source-actions {
		display: flex;
		gap: var(--space-2);
	}

	.ca__source-hint {
		margin: 0;
		font-size: var(--font-size-1);
		color: var(--color-fg-muted);
		line-height: 1.4;
	}

	.ca__source-error {
		margin: 0;
		font-size: var(--font-size-1);
		color: var(--color-danger);
	}

	/* ── Controls ─────────────────────────────────────────────────────────── */
	.ca__controls {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-2) 0 var(--space-1);
	}

	.ca__offset-group-label {
		margin: var(--space-2) 0 0;
		font-size: var(--font-size-0);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-fg-muted);
	}

	.ca__reset-row {
		display: flex;
		justify-content: flex-end;
		padding-top: var(--space-2);
	}

	/* ── Right area / drop zone ────────────────────────────────────────────── */
	.ca__drop-zone {
		/* Must behave as a flex child that fills RightPanel, then as a flex
		   container so PreviewCanvas (flex: 1 1 auto) can fill the remaining space */
		flex: 1 1 auto;
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
		position: relative;
	}

	.ca__drop-zone--active::after {
		content: '';
		position: absolute;
		inset: 4px;
		border: 2px dashed var(--color-accent, #9580ff);
		border-radius: 4px;
		pointer-events: none;
		z-index: 10;
	}
</style>
