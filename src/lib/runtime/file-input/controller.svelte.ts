import type {
	FileInputKind,
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
			input.remove();
		}

		function finish() {
			const files = Array.from(input.files ?? []);
			cleanup();
			resolve(files);
		}

		function handleChange() {
			finish();
		}

		function handleFocus() {
			window.setTimeout(() => {
				if (!input.isConnected) {
					return;
				}

				finish();
			}, 0);
		}

		window.addEventListener('focus', handleFocus, { once: true });
		input.addEventListener('change', handleChange, { once: true });
		document.body.append(input);
		input.click();
	});
}

export function createFileInputController(options: FileInputControllerOptions = {}): FileInputController {
	const allowedKinds = normalizeAllowedKinds(options.allowedKinds);
	const accept = deriveFileInputAccept(allowedKinds);
	const readItem = options.readItem ?? readFileInputItem;
	const pickFiles = options.pickFiles ?? defaultPickFiles;
	const dependencies: FileInputReaderDependencies = {
		createObjectUrl: options.createObjectUrl,
		revokeObjectUrl: options.revokeObjectUrl,
		loadImageMetadata: options.loadImageMetadata,
		loadVideoMetadata: options.loadVideoMetadata,
		readText: options.readText
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
			pickFiles,
			readItem,
			dependencies,
			revokeObjectUrl: options.revokeObjectUrl
		}
	);
}