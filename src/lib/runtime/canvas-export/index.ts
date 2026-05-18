export {
	getCanvasExportContext,
	registerCanvasExporterForLifecycle,
	setCanvasExportContext
} from './context';
export type { LifecycleCleanupRegistrar } from './context';
export {
	createCanvasExportRegistry,
	resolveCapabilities,
	type CanvasExportRegistry
} from './registry.svelte';
export { exportPng8, canExportPng, __setHtmlToImageForTests } from './png';
export {
	exportPng16,
	encodePng16,
	loadFastPng,
	__resetFastPngForTests,
	__setFastPngForTests
} from './png16';
export {
	pickRecorderMime,
	extensionFor,
	isMp4ExportAvailable,
	RECORDER_MIME_CANDIDATES,
	type PickedMime,
	type RecorderMime
} from './mime';
export { exportMp4 } from './mp4';
export { triggerDownload, defaultExportFilename } from './download';
export {
	createCanvasExportDiagnostics,
	createExporterOptions,
	reconcileExporterSelection,
	resolveActiveExporter,
	runCanvasExportTask,
	type CanvasExportDiagnostic,
	type CanvasExportRunState,
	type ExporterSelectionResult,
	type ExporterSelectOption
} from './state';
