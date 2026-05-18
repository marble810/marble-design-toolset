import type {
	FileInputKind,
	FileInputSourceSlotDefinition,
	FileInputSourceSlotState,
	FileInputSource,
	ImportedFileItem
} from '$lib/types/file-input';
import { createFileInputError, deriveFileInputAccept, normalizeAllowedKinds } from './helpers.ts';
import {
	readFileInputItem,
	type FileInputReaderDependencies
} from './readers.ts';
import {
	createFileInputControllerCore,
	type FileInputController,
	type FilePickerFunction
} from './controller-core.ts';

export interface FileInputControllerOptions extends FileInputReaderDependencies {
	allowedKinds?: readonly FileInputKind[];
	accept?: string;
	maxSizeBytes?: number | null;
	pickFiles?: FilePickerFunction;
	readItem?: (
		file: File,
		source: FileInputSource,
		dependencies: FileInputReaderDependencies
	) => Promise<ImportedFileItem>;
}

function defaultPickFiles(accept: string): Promise<File[]> {
	if (typeof document === 'undefined' || typeof window === 'undefined') {
		return Promise.reject(
			createFileInputError(
				'picker-unavailable',
				'File picker APIs are unavailable in the current environment.'
			)
		);
	}

	return new Promise((resolve) => {
		let resolved = false;

		const input = document.createElement('input');
		input.type = 'file';
		input.accept = accept;
		input.multiple = false;
		input.tabIndex = -1;
		input.style.position = 'fixed';
		input.style.left = '-9999px';
		input.style.opacity = '0';

		function cleanup() {
			window.removeEventListener('focus', handleFocus);
			input.removeEventListener('change', handleChange);
			input.removeEventListener('cancel', handleCancel);
			input.remove();
		}

		function finish() {
			if (resolved) return;
			resolved = true;
			const files = Array.from(input.files ?? []);
			cleanup();
			resolve(files);
		}

		function handleChange() {
			finish();
		}

		function handleCancel() {
			finish();
		}

		function handleFocus() {
			window.setTimeout(() => {
				finish();
			}, 300);
		}

		window.addEventListener('focus', handleFocus, { once: true });
		input.addEventListener('change', handleChange, { once: true });
		input.addEventListener('cancel', handleCancel, { once: true });
		document.body.append(input);
		input.click();
	});
}

export function createFileInputController(options: FileInputControllerOptions = {}): FileInputController {
	const allowedKinds = normalizeAllowedKinds(options.allowedKinds);
	const accept = options.accept ?? deriveFileInputAccept(allowedKinds);
	const readItem = options.readItem ?? readFileInputItem;
	const pickFiles = options.pickFiles ?? defaultPickFiles;
	const dependencies: FileInputReaderDependencies = {
		createObjectUrl: options.createObjectUrl,
		revokeObjectUrl: options.revokeObjectUrl,
		loadImageMetadata: options.loadImageMetadata,
		loadVideoMetadata: options.loadVideoMetadata,
		readText: options.readText,
		readFont: options.readFont
	};

	let busy = $state(false);
	let currentItem = $state<ImportedFileItem | null>(null);
	let lastError = $state<import('$lib/types/file-input').FileInputError | null>(null);

	return createFileInputControllerCore(
		{
			getBusy: () => busy,
			setBusy: (value) => {
				busy = value;
			},
			getCurrentItem: () => currentItem,
			setCurrentItem: (value) => {
				currentItem = value;
			},
			getLastError: () => lastError,
			setLastError: (value) => {
				lastError = value;
			}
		},
		{
			accept,
			allowedKinds,
			maxSizeBytes: options.maxSizeBytes,
			pickFiles,
			readItem,
			dependencies,
			revokeObjectUrl: options.revokeObjectUrl
		}
	);
}

export interface FileInputSlot extends FileInputController, FileInputSourceSlotState {}

export interface FileInputSlotCollection {
	readonly mode: 'slots';
	readonly slots: readonly FileInputSlot[];
	getSlot: (id: string) => FileInputSlot | null;
	clear: () => void;
	dispose: () => void;
}

export interface FileInputSlotCollectionOptions extends FileInputReaderDependencies {
	slots: readonly FileInputSourceSlotDefinition[];
	pickFiles?: FilePickerFunction;
	readItem?: FileInputControllerOptions['readItem'];
}

function normalizeSlotId(id: string): string {
	return id.trim();
}

function maxSizeMBToBytes(maxSizeMB: number | undefined): number | null {
	if (typeof maxSizeMB !== 'number' || !Number.isFinite(maxSizeMB) || maxSizeMB <= 0) {
		return null;
	}
	return maxSizeMB * 1024 * 1024;
}

export function createFileInputSlotCollection(
	options: FileInputSlotCollectionOptions
): FileInputSlotCollection {
	const seen = new Set<string>();
	const slots = options.slots.map((slotDefinition) => {
		const id = normalizeSlotId(slotDefinition.id);
		if (!id) {
			throw new Error('Source slot id must not be empty.');
		}
		if (seen.has(id)) {
			throw new Error(`Duplicate source slot id: ${id}`);
		}
		seen.add(id);

		const maxSizeBytes = maxSizeMBToBytes(slotDefinition.maxSizeMB);
		const controller = createFileInputController({
			allowedKinds: slotDefinition.allowedKinds,
			accept: slotDefinition.accept,
			maxSizeBytes,
			pickFiles: options.pickFiles,
			readItem: options.readItem,
			createObjectUrl: options.createObjectUrl,
			revokeObjectUrl: options.revokeObjectUrl,
			loadImageMetadata: options.loadImageMetadata,
			loadVideoMetadata: options.loadVideoMetadata,
			readText: options.readText,
			readFont: options.readFont
		});

		return {
			get id() {
				return id;
			},
			get name() {
				return slotDefinition.name;
			},
			get desc() {
				return slotDefinition.desc;
			},
			get required() {
				return slotDefinition.required ?? false;
			},
			get maxSizeMB() {
				return slotDefinition.maxSizeMB ?? null;
			},
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
			pick: () => controller.pick(),
			ingestFiles: (selection, source) => controller.ingestFiles(selection, source),
			clear: () => controller.clear(),
			dispose: () => controller.dispose()
		} satisfies FileInputSlot;
	});

	return {
		mode: 'slots',
		get slots() {
			return slots;
		},
		getSlot: (id) => slots.find((slot) => slot.id === id) ?? null,
		clear: () => {
			for (const slot of slots) slot.clear();
		},
		dispose: () => {
			for (const slot of slots) slot.dispose();
		}
	};
}
