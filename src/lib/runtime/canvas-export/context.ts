import { getContext, setContext } from 'svelte';
import type { CanvasExportContextValue } from '$lib/types/canvas-export';

const CANVAS_EXPORT_CONTEXT = Symbol('canvas-export-context');

export function setCanvasExportContext(context: CanvasExportContextValue): CanvasExportContextValue {
	setContext(CANVAS_EXPORT_CONTEXT, context);
	return context;
}

export function getCanvasExportContext(): CanvasExportContextValue | undefined {
	return getContext<CanvasExportContextValue | undefined>(CANVAS_EXPORT_CONTEXT);
}
