import type { CanvasExportDiagnostic, ExportResult, RegisteredExporter } from '$lib/types/canvas-export';

export type { CanvasExportDiagnostic } from '$lib/types/canvas-export';

export interface ExporterSelectOption {
	value: string;
	label: string;
}

export interface ExporterSelectionResult {
	selectedExporterId: string;
	selectionLostMessage: string;
}

export interface CanvasExportDiagnosticsInput {
	declaredImage: boolean;
	declaredVideo: boolean;
	activeExporter: RegisteredExporter | null;
	browserMp4Available: boolean;
	selectionLostMessage?: string;
}

export interface CanvasExportRunState {
	busy: boolean;
	lastResult: ExportResult | null;
}

export function createExporterOptions(
	exporters: readonly RegisteredExporter[]
): ExporterSelectOption[] {
	return exporters.map((exporter) => ({
		value: exporter.id,
		label: exporter.label
	}));
}

export function resolveActiveExporter(
	exporters: readonly RegisteredExporter[],
	selectedExporterId: string
): RegisteredExporter | null {
	return exporters.find((exporter) => exporter.id === selectedExporterId) ?? exporters[0] ?? null;
}

export function reconcileExporterSelection(
	exporters: readonly RegisteredExporter[],
	selectedExporterId: string
): ExporterSelectionResult {
	if (exporters.length === 0) {
		return { selectedExporterId: '', selectionLostMessage: '' };
	}

	if (!selectedExporterId) {
		return { selectedExporterId: exporters[0].id, selectionLostMessage: '' };
	}

	if (exporters.some((exporter) => exporter.id === selectedExporterId)) {
		return { selectedExporterId, selectionLostMessage: '' };
	}

	return {
		selectedExporterId: exporters[0].id,
		selectionLostMessage: `Selected exporter is no longer available. Using ${exporters[0].label}.`
	};
}

export function createCanvasExportDiagnostics({
	declaredImage,
	declaredVideo,
	activeExporter,
	browserMp4Available,
	selectionLostMessage = ''
}: CanvasExportDiagnosticsInput): CanvasExportDiagnostic[] {
	const diagnostics: CanvasExportDiagnostic[] = [];

	if (selectionLostMessage) {
		diagnostics.push({ id: 'exporter-lost', tone: 'warning', message: selectionLostMessage });
	}

	if (!activeExporter) {
		diagnostics.push({
			id: 'missing-exporter',
			tone: 'info',
			message: 'This tool declared export capability but has not registered an exporter yet.'
		});
		return diagnostics;
	}

	if (declaredImage && !activeExporter.resolved.png) {
		diagnostics.push({
			id: 'image-unsupported',
			tone: 'warning',
			message: 'This tool declares image export, but the selected exporter does not support PNG.'
		});
	}

	if (declaredVideo && !activeExporter.resolved.mp4) {
		diagnostics.push({
			id: 'video-unsupported',
			tone: 'warning',
			message: 'This tool declares video export, but the selected exporter does not support MP4.'
		});
	} else if (declaredVideo && !browserMp4Available) {
		diagnostics.push({
			id: 'video-browser-unsupported',
			tone: 'warning',
			message: 'Video recording is not available in this browser.'
		});
	}

	for (const [index, warning] of (activeExporter.descriptor.kind === 'dom'
		? activeExporter.descriptor.getWarnings?.() ?? []
		: []
	).entries()) {
		diagnostics.push({
			id: `exporter-warning-${index}`,
			tone: 'warning',
			message: warning
		});
	}

	return diagnostics;
}

export async function runCanvasExportTask(
	state: CanvasExportRunState,
	task: () => Promise<ExportResult>
): Promise<ExportResult> {
	state.busy = true;
	state.lastResult = null;

	try {
		const result = await task();
		state.lastResult = result;
		return result;
	} catch (error) {
		const result = { ok: false, error: error instanceof Error ? error.message : String(error) };
		state.lastResult = result;
		return result;
	} finally {
		state.busy = false;
	}
}
