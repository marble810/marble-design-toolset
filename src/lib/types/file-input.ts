export type FileInputKind = 'image' | 'video' | 'text';

export type FileInputSource = 'picker' | 'drop';

export type FileInputErrorCode =
	| 'empty-selection'
	| 'multiple-files'
	| 'unsupported-kind'
	| 'picker-unavailable'
	| 'picker-failed'
	| 'text-read-failed'
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

export type ImportedFileItem =
	| ImportedImageFileItem
	| ImportedVideoFileItem
	| ImportedTextFileItem;

export interface FileInputControllerState {
	accept: string;
	allowedKinds: ReadonlyArray<FileInputKind>;
	busy: boolean;
	currentItem: ImportedFileItem | null;
	lastError: FileInputError | null;
}

export type FileInputSelection = Iterable<File> | ArrayLike<File> | null | undefined;