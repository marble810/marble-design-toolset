export type FileInputKind = 'image' | 'video' | 'text' | 'font';

export type FileInputSource = 'picker' | 'drop';

export type FileInputErrorCode =
	| 'empty-selection'
	| 'multiple-files'
	| 'unsupported-kind'
	| 'picker-unavailable'
	| 'picker-failed'
	| 'text-read-failed'
	| 'font-read-failed'
	| 'max-size-exceeded'
	| 'image-metadata-failed'
	| 'video-metadata-failed';

export interface FileInputError {
	code: FileInputErrorCode;
	message: string;
	source: FileInputSource | null;
	fileName?: string;
	kind?: FileInputKind;
	cause?: unknown;
}

export interface ImportedFileItemBase {
	kind: FileInputKind;
	source: FileInputSource;
	file: File;
	name: string;
	mimeType: string;
	size: number;
	lastModified: number;
}

export interface ImportedImageFileItem extends ImportedFileItemBase {
	kind: 'image';
	objectUrl: string;
	width: number;
	height: number;
}

export interface ImportedVideoFileItem extends ImportedFileItemBase {
	kind: 'video';
	objectUrl: string;
	width: number;
	height: number;
	duration: number;
}

export interface ImportedTextFileItem extends ImportedFileItemBase {
	kind: 'text';
	text: string;
}

export interface ImportedFontFileItem extends ImportedFileItemBase {
	kind: 'font';
	arrayBuffer: ArrayBuffer;
	dataUrl: string;
}

export type ImportedFileItem =
	| ImportedImageFileItem
	| ImportedVideoFileItem
	| ImportedTextFileItem
	| ImportedFontFileItem;

export interface FileInputControllerState {
	accept: string;
	allowedKinds: ReadonlyArray<FileInputKind>;
	busy: boolean;
	currentItem: ImportedFileItem | null;
	lastError: FileInputError | null;
}

export type FileInputSelection = Iterable<File> | ArrayLike<File> | null | undefined;

export interface FileInputSourceSlotDefinition {
	id: string;
	name: string;
	desc: string;
	allowedKinds?: readonly FileInputKind[];
	required?: boolean;
	accept?: string;
	maxSizeMB?: number;
}

export interface FileInputSourceSlotState extends FileInputControllerState {
	id: string;
	name: string;
	desc: string;
	required: boolean;
	maxSizeMB: number | null;
}
