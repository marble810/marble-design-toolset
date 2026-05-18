import { getContext, setContext } from 'svelte';
import type {
	CanvasExportContextValue,
	CanvasExporterDescriptor,
	CanvasExporterRegistrationOptions
} from '$lib/types/canvas-export';

const CANVAS_EXPORT_CONTEXT = Symbol('canvas-export-context');

export type LifecycleCleanupRegistrar = (cleanup: () => void) => () => void;

export function setCanvasExportContext(context: CanvasExportContextValue): CanvasExportContextValue {
	setContext(CANVAS_EXPORT_CONTEXT, context);
	return context;
}

export function getCanvasExportContext(): CanvasExportContextValue | undefined {
	return getContext<CanvasExportContextValue | undefined>(CANVAS_EXPORT_CONTEXT);
}

export function registerCanvasExporterForLifecycle(
	context: CanvasExportContextValue | undefined,
	descriptor: CanvasExporterDescriptor,
	addCleanup: LifecycleCleanupRegistrar,
	options?: CanvasExporterRegistrationOptions
): () => void {
	const unregister = context?.register(descriptor, options) ?? (() => {});
	let cleaned = false;

	return addCleanup(() => {
		if (cleaned) return;
		cleaned = true;
		unregister();
	});
}
