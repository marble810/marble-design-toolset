<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Section } from '../section/index.js';
	import { getCanvasExportContext } from '$lib/runtime/canvas-export/context';
	import { exportPng8 } from '$lib/runtime/canvas-export/png';
	import { exportPng16 } from '$lib/runtime/canvas-export/png16';
	import { exportMp4 } from '$lib/runtime/canvas-export/mp4';
	import { isMp4ExportAvailable } from '$lib/runtime/canvas-export/mime';
	import { defaultExportFilename } from '$lib/runtime/canvas-export/download';
	import type { ExportResult } from '$lib/types/canvas-export';
	import type { ToolExportCapabilities } from '$lib/types/tool';
	import { getToolShellContext } from '$lib/runtime/tool-shell-context';

	interface Props {
		exportCapabilities: ToolExportCapabilities;
	}

	let { exportCapabilities }: Props = $props();

	const exportContext = getCanvasExportContext();
	const shellContext = getToolShellContext();

	const toolId = $derived(slugify(shellContext?.metadata?.name ?? 'export'));
	const activeExporter = $derived(exportContext?.exporters?.[0] ?? null);

	function slugify(name: string): string {
		return name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'export';
	}

	const declaredImage = exportCapabilities.image === true;
	const declaredVideo = exportCapabilities.video === true;

	const supportsPng = $derived(activeExporter?.resolved?.png === true);
	const supportsMp4 = $derived(
		activeExporter?.resolved?.mp4 === true && isMp4ExportAvailable()
	);
	const supports16Bit = $derived(activeExporter?.resolved?.pngBitDepth === 16);

	type Tab = 'image' | 'video';
	let activeTab = $state<Tab>(declaredImage ? 'image' : 'video');

	$effect(() => {
		if (activeTab === 'image' && !declaredImage && declaredVideo) activeTab = 'video';
		if (activeTab === 'video' && !declaredVideo && declaredImage) activeTab = 'image';
	});

	// Image form state
	let imageScale = $state<1 | 2 | 4>(1);
	let imageBitDepth = $state<8 | 16>(8);
	let imageFilename = $state('');

	$effect(() => {
		// Force scale ≤2 when 16-bit selected
		if (imageBitDepth === 16 && imageScale === 4) imageScale = 2;
	});
	$effect(() => {
		// Reset to 8 if exporter loses 16-bit capability
		if (!supports16Bit && imageBitDepth === 16) imageBitDepth = 8;
	});

	// Video form state
	let videoScale = $state<1 | 2 | 4>(1);
	let videoFps = $state<24 | 30 | 60>(30);
	let videoDuration = $state(3);
	let videoFilename = $state('');

	let busy = $state(false);
	let lastResult = $state<ExportResult | null>(null);

	function ensureFilename(value: string): string {
		const trimmed = value.trim();
		if (trimmed.length > 0) return trimmed;
		return defaultExportFilename(toolId);
	}

	function clampDuration(v: number): number {
		if (!Number.isFinite(v)) return 3;
		return Math.min(30, Math.max(1, Math.round(v)));
	}

	async function runImageExport() {
		if (!activeExporter) return;
		busy = true;
		lastResult = null;
		try {
			const filename = ensureFilename(imageFilename);
			const opts = {
				scale: imageScale,
				bitDepth: imageBitDepth,
				filename
			} as const;
			if (imageBitDepth === 16) {
				lastResult = await exportPng16({
					descriptor: activeExporter.descriptor,
					options: opts
				});
			} else {
				lastResult = await exportPng8({
					descriptor: activeExporter.descriptor,
					contentWidth: activeExporter.descriptor.contentWidth,
					contentHeight: activeExporter.descriptor.contentHeight,
					options: opts
				});
			}
		} catch (err) {
			lastResult = { ok: false, error: err instanceof Error ? err.message : String(err) };
		} finally {
			busy = false;
		}
	}

	async function runVideoExport() {
		if (!activeExporter) return;
		busy = true;
		lastResult = null;
		try {
			const duration = clampDuration(videoDuration);
			const filename = ensureFilename(videoFilename);
			lastResult = await exportMp4({
				descriptor: activeExporter.descriptor,
				contentWidth: activeExporter.descriptor.contentWidth,
				contentHeight: activeExporter.descriptor.contentHeight,
				options: {
					scale: videoScale,
					fps: videoFps,
					durationSeconds: duration,
					filename
				}
			});
		} catch (err) {
			lastResult = { ok: false, error: err instanceof Error ? err.message : String(err) };
		} finally {
			busy = false;
		}
	}

	const imageButtonLabel = $derived(busy ? 'Exporting…' : 'Export Image');
	const videoButtonLabel = $derived(busy ? 'Recording…' : 'Export Video');
	const imageDisabled = $derived(!activeExporter || !supportsPng || busy);
	const videoDisabled = $derived(!activeExporter || !supportsMp4 || busy);
</script>

<Section title="Export" collapsible>
	{#if !activeExporter}
		<p class="export-section__hint">
			This tool declared an export capability but has not registered an exporter yet. Export
			controls become active once the tool's preview component calls
			<code>getCanvasExportContext().register(...)</code>.
		</p>
	{/if}

	{#if declaredImage && declaredVideo}
		<div class="export-section__tabs" role="tablist">
			<button
				type="button"
				role="tab"
				class="export-section__tab"
				data-active={activeTab === 'image'}
				onclick={() => (activeTab = 'image')}
			>
				Image
			</button>
			<button
				type="button"
				role="tab"
				class="export-section__tab"
				data-active={activeTab === 'video'}
				onclick={() => (activeTab = 'video')}
			>
				Video
			</button>
		</div>
	{/if}

	{#if activeTab === 'image' && declaredImage}
		<div class="export-section__form">
			<label class="export-section__field">
				<span class="export-section__label">Scale</span>
				<div class="export-section__seg">
					{#each [1, 2, 4] as opt (opt)}
						<button
							type="button"
							class="export-section__seg-btn"
							data-active={imageScale === opt}
							disabled={imageBitDepth === 16 && opt === 4}
							onclick={() => (imageScale = opt as 1 | 2 | 4)}
						>
							{opt}×
						</button>
					{/each}
				</div>
			</label>

			{#if supports16Bit}
				<label class="export-section__field">
					<span class="export-section__label">Bit depth</span>
					<div class="export-section__seg">
						{#each [8, 16] as opt (opt)}
							<button
								type="button"
								class="export-section__seg-btn"
								data-active={imageBitDepth === opt}
								onclick={() => (imageBitDepth = opt as 8 | 16)}
							>
								{opt}-bit
							</button>
						{/each}
					</div>
				</label>
			{/if}

			<label class="export-section__field">
				<span class="export-section__label">Filename</span>
				<div class="export-section__filename">
					<input
						type="text"
						class="export-section__input"
						placeholder={defaultExportFilename(toolId)}
						bind:value={imageFilename}
					/>
					<span class="export-section__suffix">.png</span>
				</div>
			</label>

			<Button variant="solid" size="sm" disabled={imageDisabled} onclick={runImageExport}>
				{imageButtonLabel}
			</Button>
		</div>
	{/if}

	{#if activeTab === 'video' && declaredVideo}
		<div class="export-section__form">
			{#if !supportsMp4 && activeExporter}
				<p class="export-section__hint">
					Video recording is not available in this browser or for this exporter.
				</p>
			{/if}
			<label class="export-section__field">
				<span class="export-section__label">Scale</span>
				<div class="export-section__seg">
					{#each [1, 2, 4] as opt (opt)}
						<button
							type="button"
							class="export-section__seg-btn"
							data-active={videoScale === opt}
							onclick={() => (videoScale = opt as 1 | 2 | 4)}
						>
							{opt}×
						</button>
					{/each}
				</div>
			</label>

			<label class="export-section__field">
				<span class="export-section__label">FPS</span>
				<div class="export-section__seg">
					{#each [24, 30, 60] as opt (opt)}
						<button
							type="button"
							class="export-section__seg-btn"
							data-active={videoFps === opt}
							onclick={() => (videoFps = opt as 24 | 30 | 60)}
						>
							{opt}
						</button>
					{/each}
				</div>
			</label>

			<label class="export-section__field">
				<span class="export-section__label">Duration (s)</span>
				<input
					type="number"
					min="1"
					max="30"
					step="1"
					class="export-section__input"
					bind:value={videoDuration}
					onblur={() => (videoDuration = clampDuration(videoDuration))}
				/>
			</label>

			<label class="export-section__field">
				<span class="export-section__label">Filename</span>
				<input
					type="text"
					class="export-section__input"
					placeholder={defaultExportFilename(toolId)}
					bind:value={videoFilename}
				/>
			</label>

			<Button variant="solid" size="sm" disabled={videoDisabled} onclick={runVideoExport}>
				{videoButtonLabel}
			</Button>
		</div>
	{/if}

	{#if lastResult}
		<div class="export-section__result" data-ok={lastResult.ok}>
			{#if lastResult.ok}
				<span>Saved {lastResult.filename}</span>
				{#if lastResult.notice}
					<span class="export-section__notice">{lastResult.notice}</span>
				{/if}
			{:else}
				<span>Export failed: {lastResult.error}</span>
			{/if}
		</div>
	{/if}
</Section>

<style>
	.export-section__hint {
		margin: 0;
		font-size: var(--font-size-1);
		line-height: 1.5;
		color: var(--color-fg-muted);
	}

	.export-section__hint code {
		font-family: var(--font-family-mono, monospace);
		font-size: var(--font-size-1);
		padding: 0 4px;
		background: rgba(255, 255, 255, 0.06);
	}

	.export-section__tabs {
		display: inline-flex;
		gap: 0;
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	.export-section__tab {
		padding: 4px 12px;
		font-size: var(--font-size-1);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		background: transparent;
		color: var(--color-fg-muted);
		border: none;
		cursor: pointer;
	}

	.export-section__tab[data-active='true'] {
		background: rgba(149, 128, 255, 0.18);
		color: var(--color-fg-primary);
	}

	.export-section__form {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.export-section__field {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: var(--font-size-1);
	}

	.export-section__label {
		font-size: var(--font-size-1);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-fg-muted);
	}

	.export-section__seg {
		display: inline-flex;
		gap: 0;
		border: 1px solid rgba(255, 255, 255, 0.08);
		width: fit-content;
	}

	.export-section__seg-btn {
		padding: 4px 10px;
		background: transparent;
		color: var(--color-fg-muted);
		border: none;
		cursor: pointer;
		font-size: var(--font-size-1);
	}

	.export-section__seg-btn[data-active='true'] {
		background: rgba(149, 128, 255, 0.18);
		color: var(--color-fg-primary);
	}

	.export-section__seg-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.export-section__filename {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}

	.export-section__input {
		flex: 1 1 auto;
		min-width: 0;
		padding: 4px 6px;
		background: var(--color-bg-inset);
		color: var(--color-fg-primary);
		border: 1px solid rgba(255, 255, 255, 0.08);
		font-family: inherit;
		font-size: var(--font-size-1);
	}

	.export-section__suffix {
		color: var(--color-fg-muted);
		font-size: var(--font-size-1);
	}

	.export-section__result {
		padding: 6px 8px;
		font-size: var(--font-size-1);
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.export-section__result[data-ok='true'] {
		color: var(--color-fg-primary);
		background: rgba(120, 220, 160, 0.12);
	}

	.export-section__result[data-ok='false'] {
		color: var(--color-fg-primary);
		background: rgba(220, 120, 120, 0.12);
	}

	.export-section__notice {
		color: var(--color-fg-muted);
	}
</style>
