import type {
	FileInputControllerState,
	FileInputError,
	FileInputKind,
	FileInputSelection,
	FileInputSource,
	ImportedFileItem
} from '$lib/types/file-input';
import {
	createFileInputError,
	toFileInputError,
	validateFileInputSelection
} from './helpers.ts';
import {
	revokeImportedFileItem,
	type FileInputReaderDependencies
} from './readers.ts';

export interface FilePickerFunction {
	(accept: string): Promise<File[]>;
}

export interface FileInputController extends FileInputControllerState {
	pick: () => Promise<ImportedFileItem | null>;
	ingestFiles: (
		selection: FileInputSelection,
		source?: FileInputSource
	) => Promise<ImportedFileItem | null>;
	clear: () => void;
	dispose: () => void;
}

export interface FileInputControllerCoreState {
	getBusy: () => boolean;
	setBusy: (value: boolean) => void;
	getCurrentItem: () => ImportedFileItem | null;
	setCurrentItem: (value: ImportedFileItem | null) => void;
	getLastError: () => FileInputError | null;
	setLastError: (value: FileInputError | null) => void;
}

export interface FileInputControllerCoreConfig {
	accept: string;
	allowedKinds: readonly FileInputKind[];
	pickFiles: FilePickerFunction;
	readItem: (
		file: File,
		source: FileInputSource,
		dependencies: FileInputReaderDependencies
	) => Promise<ImportedFileItem>;
	dependencies: FileInputReaderDependencies;
	revokeObjectUrl?: (objectUrl: string) => void;
}

export function createFileInputControllerCore(
	state: FileInputControllerCoreState,
	config: FileInputControllerCoreConfig
): FileInputController {
	async function ingestFiles(
		selection: FileInputSelection,
		source: FileInputSource = 'drop'
	): Promise<ImportedFileItem | null> {
		const validated = validateFileInputSelection(selection, config.allowedKinds, source);
		if (!validated.ok) {
			state.setBusy(false);
			state.setLastError(validated.error);
			return null;
		}

		state.setBusy(true);

		try {
			const nextItem = await config.readItem(validated.file, source, config.dependencies);
			const previousItem = state.getCurrentItem();
			state.setCurrentItem(nextItem);
			state.setLastError(null);
			revokeImportedFileItem(previousItem, config.revokeObjectUrl);
			return nextItem;
		} catch (error) {
			state.setLastError(
				toFileInputError(
					error,
					createFileInputError('unsupported-kind', 'Failed to import the selected file.', {
						source,
						fileName: validated.file.name,
						kind: validated.kind,
						cause: error
					})
				)
			);
			return null;
		} finally {
			state.setBusy(false);
		}
	}

	async function pick(): Promise<ImportedFileItem | null> {
		state.setBusy(true);

		try {
			const files = await config.pickFiles(config.accept);
			return await ingestFiles(files, 'picker');
		} catch (error) {
			state.setLastError(
				toFileInputError(
					error,
					createFileInputError('picker-failed', 'Failed to open the file picker.', {
						source: 'picker',
						cause: error
					})
				)
			);
			return null;
		} finally {
			state.setBusy(false);
		}
	}

	function clear(): void {
		revokeImportedFileItem(state.getCurrentItem(), config.revokeObjectUrl);
		state.setCurrentItem(null);
		state.setLastError(null);
		state.setBusy(false);
	}

	function dispose(): void {
		clear();
	}

	return {
		get accept() {
			return config.accept;
		},
		get allowedKinds() {
			return config.allowedKinds;
		},
		get busy() {
			return state.getBusy();
		},
		get currentItem() {
			return state.getCurrentItem();
		},
		get lastError() {
			return state.getLastError();
		},
		pick,
		ingestFiles,
		clear,
		dispose
	};
}