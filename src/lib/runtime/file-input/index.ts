export {
	createFileInputController,
	createFileInputSlotCollection,
	type FileInputSlot,
	type FileInputSlotCollection,
	type FileInputSlotCollectionOptions,
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
	type FontReadResult,
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
	FileInputSourceSlotDefinition,
	FileInputSourceSlotState,
	ImportedFileItem,
	ImportedFileItemBase,
	ImportedFontFileItem,
	ImportedImageFileItem,
	ImportedTextFileItem,
	ImportedVideoFileItem
} from '$lib/types/file-input';
