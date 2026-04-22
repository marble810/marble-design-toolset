export {
	createFileInputController,
	type FileInputController,
	type FileInputControllerOptions,
	type FilePickerFunction
} from './controller.svelte.ts';
export {
	createFileInputError,
	deriveFileInputAccept,
	extractDroppedFiles,
	getImportedItemObjectUrl,
	inferFileInputKind,
	normalizeAllowedKinds,
	normalizeFileInputSelection,
	toFileInputError,
	validateFileInputSelection
} from './helpers.ts';
export {
	readFileInputItem,
	revokeImportedFileItem,
	type FileInputReaderDependencies,
	type ImageMetadata,
	type VideoMetadata
} from './readers.ts';
export type {
	FileInputControllerState,
	FileInputError,
	FileInputErrorCode,
	FileInputKind,
	FileInputSelection,
	FileInputSource,
	ImportedFileItem,
	ImportedFileItemBase,
	ImportedImageFileItem,
	ImportedTextFileItem,
	ImportedVideoFileItem
} from '$lib/types/file-input';