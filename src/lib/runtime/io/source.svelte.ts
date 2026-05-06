import type { FileInputSelection, ImportedFileItem } from '$lib/types/file-input';
import {
	createFileInputController,
	extractDroppedFiles,
	type FileInputController,
	type FileInputControllerOptions
} from '$lib/runtime/file-input/index.js';
import { summarizeImportedFileItem, type ImportedFileSummary } from './summary.js';

export interface ToolSourceInput extends FileInputController {
	readonly summary: ImportedFileSummary | null;
	readonly isDragOver: boolean;
	ingestDrop: (selection: FileInputSelection) => Promise<ImportedFileItem | null>;
	handleDragOver: (event: DragEvent) => void;
	handleDragLeave: (event: DragEvent) => void;
	handleDrop: (event: DragEvent) => Promise<ImportedFileItem | null>;
}

export function createToolSourceInput(options: FileInputControllerOptions = {}): ToolSourceInput {
	const controller = createFileInputController(options);
	let isDragOver = $state(false);

	async function ingestDrop(selection: FileInputSelection): Promise<ImportedFileItem | null> {
		return controller.ingestFiles(selection, 'drop');
	}

	function handleDragOver(event: DragEvent): void {
		event.preventDefault();
		isDragOver = true;
	}

	function handleDragLeave(event: DragEvent): void {
		const target = event.relatedTarget as Node | null;
		const current = event.currentTarget as HTMLElement | null;
		if (!target || !current?.contains(target)) {
			isDragOver = false;
		}
	}

	async function handleDrop(event: DragEvent): Promise<ImportedFileItem | null> {
		event.preventDefault();
		isDragOver = false;
		return ingestDrop(extractDroppedFiles(event));
	}

	return {
		get accept() {
			return controller.accept;
		},
		get allowedKinds() {
			return controller.allowedKinds;
		},
		get busy() {
			return controller.busy;
		},
		get currentItem() {
			return controller.currentItem;
		},
		get lastError() {
			return controller.lastError;
		},
		get summary() {
			return controller.currentItem ? summarizeImportedFileItem(controller.currentItem) : null;
		},
		get isDragOver() {
			return isDragOver;
		},
		pick: () => controller.pick(),
		ingestFiles: (selection, source) => controller.ingestFiles(selection, source),
		clear: () => controller.clear(),
		dispose: () => controller.dispose(),
		ingestDrop,
		handleDragOver,
		handleDragLeave,
		handleDrop
	};
}