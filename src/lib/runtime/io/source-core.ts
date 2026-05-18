import type {
	FileInputSelection,
	ImportedFileItem
} from '../../types/file-input.ts';
import {
	extractDroppedFiles,
	type FileInputController,
	type FileInputControllerOptions,
	type FileInputSlotCollection,
	type FileInputSlotCollectionOptions,
	type FileInputSlot
} from '../file-input/index.ts';
import { summarizeImportedFileItem, type ImportedFileSummary } from './summary.ts';

export type ToolSourceInputOptions = FileInputControllerOptions;
export type ToolSourceSlotCollectionOptions = FileInputSlotCollectionOptions;

export interface ToolSourceInput extends FileInputController {
	readonly mode?: 'single';
	readonly summary: ImportedFileSummary | null;
	readonly isDragOver: boolean;
	ingestDrop: (selection: FileInputSelection) => Promise<ImportedFileItem | null>;
	handleDragOver: (event: DragEvent) => void;
	handleDragLeave: (event: DragEvent) => void;
	handleDrop: (event: DragEvent) => Promise<ImportedFileItem | null>;
}

export interface ToolSourceSlot extends FileInputSlot {
	readonly summary: ImportedFileSummary | null;
	readonly isDragOver: boolean;
	ingestDrop: (selection: FileInputSelection) => Promise<ImportedFileItem | null>;
	handleDragOver: (event: DragEvent) => void;
	handleDragLeave: (event: DragEvent) => void;
	handleDrop: (event: DragEvent) => Promise<ImportedFileItem | null>;
}

export interface ToolSourceSlotCollection {
	readonly mode: 'slots';
	readonly slots: readonly ToolSourceSlot[];
	getSlot: (id: string) => ToolSourceSlot | null;
	clear: () => void;
	dispose: () => void;
}

export interface ToolSourceInputCoreState {
	getIsDragOver: () => boolean;
	setIsDragOver: (value: boolean) => void;
}

export interface ToolSourceSlotCollectionCoreState {
	getIsDragOver: (slotId: string) => boolean;
	setIsDragOver: (slotId: string, value: boolean) => void;
}

function handleDragOverForSlot(
	event: DragEvent,
	slotId: string,
	state: ToolSourceSlotCollectionCoreState
): void {
	event.preventDefault();
	state.setIsDragOver(slotId, true);
}

function handleDragLeaveForSlot(
	event: DragEvent,
	slotId: string,
	state: ToolSourceSlotCollectionCoreState
): void {
	const target = event.relatedTarget as Node | null;
	const current = event.currentTarget as HTMLElement | null;
	if (!target || !current?.contains(target)) {
		state.setIsDragOver(slotId, false);
	}
}

export function createToolSourceInputCore(
	controller: FileInputController,
	state: ToolSourceInputCoreState
): ToolSourceInput {
	async function ingestDrop(selection: FileInputSelection): Promise<ImportedFileItem | null> {
		return controller.ingestFiles(selection, 'drop');
	}

	function handleDragOver(event: DragEvent): void {
		event.preventDefault();
		state.setIsDragOver(true);
	}

	function handleDragLeave(event: DragEvent): void {
		const target = event.relatedTarget as Node | null;
		const current = event.currentTarget as HTMLElement | null;
		if (!target || !current?.contains(target)) {
			state.setIsDragOver(false);
		}
	}

	async function handleDrop(event: DragEvent): Promise<ImportedFileItem | null> {
		event.preventDefault();
		state.setIsDragOver(false);
		return ingestDrop(extractDroppedFiles(event));
	}

	return {
		mode: 'single',
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
			return state.getIsDragOver();
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

export function createToolSourceSlotCollectionCore(
	collection: FileInputSlotCollection,
	state: ToolSourceSlotCollectionCoreState
): ToolSourceSlotCollection {
	function wrapSlot(slot: FileInputSlot): ToolSourceSlot {
		async function ingestDrop(selection: FileInputSelection): Promise<ImportedFileItem | null> {
			return slot.ingestFiles(selection, 'drop');
		}

		async function handleDrop(event: DragEvent): Promise<ImportedFileItem | null> {
			event.preventDefault();
			state.setIsDragOver(slot.id, false);
			return ingestDrop(extractDroppedFiles(event));
		}

		return {
			get id() {
				return slot.id;
			},
			get name() {
				return slot.name;
			},
			get desc() {
				return slot.desc;
			},
			get required() {
				return slot.required;
			},
			get maxSizeMB() {
				return slot.maxSizeMB;
			},
			get accept() {
				return slot.accept;
			},
			get allowedKinds() {
				return slot.allowedKinds;
			},
			get busy() {
				return slot.busy;
			},
			get currentItem() {
				return slot.currentItem;
			},
			get lastError() {
				return slot.lastError;
			},
			get summary() {
				return slot.currentItem ? summarizeImportedFileItem(slot.currentItem) : null;
			},
			get isDragOver() {
				return state.getIsDragOver(slot.id);
			},
			pick: () => slot.pick(),
			ingestFiles: (selection, source) => slot.ingestFiles(selection, source),
			clear: () => slot.clear(),
			dispose: () => slot.dispose(),
			ingestDrop,
			handleDragOver: (event) => handleDragOverForSlot(event, slot.id, state),
			handleDragLeave: (event) => handleDragLeaveForSlot(event, slot.id, state),
			handleDrop
		};
	}

	const slots = collection.slots.map(wrapSlot);

	return {
		mode: 'slots',
		get slots() {
			return slots;
		},
		getSlot: (id) => slots.find((slot) => slot.id === id) ?? null,
		clear: () => collection.clear(),
		dispose: () => collection.dispose()
	};
}
