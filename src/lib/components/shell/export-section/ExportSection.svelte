<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { SelectField } from '$lib/components/ui/index.js';
	import { Section } from '../section/index.js';
	import { getCanvasExportContext } from '$lib/runtime/canvas-export/context';
	import { exportPng8 } from '$lib/runtime/canvas-export/png';
	import { exportPng16 } from '$lib/runtime/canvas-export/png16';
	import { exportMp4 } from '$lib/runtime/canvas-export/mp4';
	import { isMp4ExportAvailable } from '$lib/runtime/canvas-export/mime';
	import { defaultExportFilename } from '$lib/runtime/canvas-export/download';
	import {
		createCanvasExportDiagnostics,
		createExporterOptions,
		reconcileExporterSelection,
		resolveActiveExporter,
		runCanvasExportTask,
		type CanvasExportRunState
	} from '$lib/runtime/canvas-export/state';
	import type { ToolExportCapabilities } from '$lib/types/tool';
	import { getToolRuntimeContext } from '$lib/runtime/tool-runtime-context';

	interface Props {
		exportCapabilities: ToolExportCapabilities;
	}

	let { exportCapabilities }: Props = $props();

	const exportContext = getCanvasExportContext();
	const toolRuntimeContext = getToolRuntimeContext();

	const toolId = $derived(toolRuntimeContext?.toolId || 'export');
	const exporters = $derived(exportContext?.exporters ?? []);
	const exporterOptions = $derived(createExporterOptions(exporters));
	let selectedExporterId = $state('');
	let selectionLostMessage = $state('');
	const activeExporter = $derived(resolveActiveExporter(exporters, selectedExporterId));

	const declaredImage = $derived(exportCapabilities.image === true);
	const declaredVideo = $derived(exportCapabilities.video === true);
	const browserMp4Available = $derived(isMp4ExportAvailable());

	const supportsPng = $derived(activeExporter?.resolved?.png === true);
	const supportsMp4 = $derived(activeExporter?.resolved?.mp4 === true && browserMp4Available);
	const supports16Bit = $derived(activeExporter?.resolved?.pngBitDepth === 16);
	const diagnostics = $derived(
		createCanvasExportDiagnostics({
			declaredImage,
			declaredVideo,
			activeExporter,
			browserMp4Available,
			selectionLostMessage
		})
	);

	type Tab = 'image' | 'video';
	let activeTab = $state<Tab>('image');

	$effect(() => {
		if (activeTab === 'image' && !declaredImage && declaredVideo) activeTab = 'video';
		if (activeTab === 'video' && !declaredVideo && declaredImage) activeTab = 'image';
	});

	$effect(() => {
		const nextSelection = reconcileExporterSelection(exporters, selectedExporterId);
		if (nextSelection.selectedExporterId !== selectedExporterId) {
			selectedExporterId = nextSelection.selectedExporterId;
			selectionLostMessage = nextSelection.selectionLostMessage;
		}
		if (exporters.length === 0) {
			selectionLostMessage = '';
		}
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

	const exportRunState = $state<CanvasExportRunState>({ busy: false, lastResult: null });
	const busy = $derived(exportRunState.busy);
	const lastResult = $derived(exportRunState.lastResult);

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
		await runCanvasExportTask(exportRunState, async () => {
			const filename = ensureFilename(imageFilename);
			const opts = {
				scale: imageScale,
				bitDepth: imageBitDepth,
				filename
			} as const;
			if (imageBitDepth === 16) {
				return exportPng16({
					descriptor: activeExporter.descriptor,
					options: opts
				});
			}
			return exportPng8({
				descriptor: activeExporter.descriptor,
				contentWidth: activeExporter.descriptor.contentWidth,
				contentHeight: activeExporter.descriptor.contentHeight,
				options: opts
			});
		});
	}

	async function runVideoExport() {
		if (!activeExporter) return;
		await runCanvasExportTask(exportRunState, async () => {
			const duration = clampDuration(videoDuration);
			const filename = ensureFilename(videoFilename);
			return exportMp4({
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
		});
	}

	function selectExporter(value: string) {
		selectedExporterId = value;
		selectionLostMessage = '';
	}

	const imageButtonLabel = $derived(busy ? 'Exporting…' : 'Export Image');
	const videoButtonLabel = $derived(busy ? 'Recording…' : 'Export Video');
	const imageDisabled = $derived(!activeExporter || !supportsPng || busy);
	const videoDisabled = $derived(!activeExporter || !supportsMp4 || busy);
</script>

<Section title="Export" collapsible>
	{#if exporterOptions.length > 1}
		<SelectField
			label="Exporter"
			value={selectedExporterId}
			options={exporterOptions}
			onchange={selectExporter}
		/>
	{/if}

	{#if diagnostics.length > 0}
		<div class="export-section__diagnostics">
			{#each diagnostics as diagnostic (diagnostic.id)}
				<p class="export-section__hint" data-tone={diagnostic.tone}>{diagnostic.message}</p>
			{/each}
		</div>
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
				{#each lastResult.warnings ?? [] as warning}
					<span class="export-section__notice">{warning}</span>
				{/each}
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

	.export-section__diagnostics {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.export-section__hint[data-tone='warning'] {
		color: #ffd49a;
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
