import { createFileInputController } from '$lib/runtime/file-input/index.js';
import { createFileInputSlotCollection } from '$lib/runtime/file-input/index.js';
import {
	createToolSourceInputCore,
	createToolSourceSlotCollectionCore,
	type ToolSourceInput,
	type ToolSourceInputOptions,
	type ToolSourceSlotCollection,
	type ToolSourceSlotCollectionOptions
} from './source-core.ts';

export type {
	ToolSourceInput,
	ToolSourceInputOptions,
	ToolSourceSlot,
	ToolSourceSlotCollection,
	ToolSourceSlotCollectionOptions
} from './source-core.ts';

export function createToolSourceInput(options: ToolSourceInputOptions = {}): ToolSourceInput {
	const controller = createFileInputController(options);
	let isDragOver = $state(false);

	return createToolSourceInputCore(controller, {
		getIsDragOver: () => isDragOver,
		setIsDragOver: (value) => {
			isDragOver = value;
		}
	});
}

export function createToolSourceSlotCollection(
	options: ToolSourceSlotCollectionOptions
): ToolSourceSlotCollection {
	const collection = createFileInputSlotCollection(options);
	let dragState = $state<Record<string, boolean>>({});

	return createToolSourceSlotCollectionCore(collection, {
		getIsDragOver: (slotId) => dragState[slotId] ?? false,
		setIsDragOver: (slotId, value) => {
			dragState = { ...dragState, [slotId]: value };
		}
	});
}
