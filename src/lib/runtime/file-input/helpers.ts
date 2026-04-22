import type {
	FileInputError,
	FileInputErrorCode,
	FileInputKind,
	FileInputSelection,
	FileInputSource,
	ImportedFileItem
} from '$lib/types/file-input';

const KIND_ORDER: FileInputKind[] = ['image', 'video', 'text'];

const IMAGE_EXTENSIONS = new Set([
	'png',
	'jpg',
	'jpeg',
	'gif',
	'webp',
	'bmp',
	'avif',
	'svg'
]);

const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'm4v', 'ogv']);

const TEXT_EXTENSIONS = new Set([
	'txt',
	'md',
	'csv',
	'tsv',
	'json',
	'jsonc',
	'yaml',
	'yml',
	'xml',
	'svg',
	'html',
	'htm',
	'css',
	'js',
	'ts'
]);

const TEXT_MIME_TYPES = new Set([
	'application/json',
	'application/ld+json',
	'application/xml',
	'application/x-yaml',
	'image/svg+xml'
]);

const ACCEPT_PATTERNS: Record<FileInputKind, string[]> = {
	image: ['image/*', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.avif', '.svg'],
	video: ['video/*', '.mp4', '.webm', '.mov', '.m4v', '.ogv'],
	text: ['text/*', '.txt', '.md', '.csv', '.json', '.yaml', '.yml', '.xml', '.svg']
};

function getFileExtension(fileName: string): string {
	const lastSegment = fileName.toLowerCase().split('.').pop();
	return lastSegment ?? '';
}

export function normalizeAllowedKinds(allowedKinds?: readonly FileInputKind[]): FileInputKind[] {
	if (!allowedKinds || allowedKinds.length === 0) {
		return [...KIND_ORDER];
	}

	const seen = new Set<FileInputKind>();
	for (const kind of allowedKinds) {
		if (KIND_ORDER.includes(kind) && !seen.has(kind)) {
			seen.add(kind);
		}
	}

	return seen.size > 0 ? KIND_ORDER.filter((kind) => seen.has(kind)) : [...KIND_ORDER];
}

export function deriveFileInputAccept(allowedKinds?: readonly FileInputKind[]): string {
	const patterns = normalizeAllowedKinds(allowedKinds).flatMap((kind) => ACCEPT_PATTERNS[kind]);
	return [...new Set(patterns)].join(',');
}

export function inferFileInputKind(file: Pick<File, 'name' | 'type'>): FileInputKind | null {
	const mimeType = file.type.toLowerCase();
	const extension = getFileExtension(file.name);

	if (mimeType.startsWith('image/') || IMAGE_EXTENSIONS.has(extension)) {
		return 'image';
	}

	if (mimeType.startsWith('video/') || VIDEO_EXTENSIONS.has(extension)) {
		return 'video';
	}

	if (mimeType.startsWith('text/') || TEXT_MIME_TYPES.has(mimeType) || TEXT_EXTENSIONS.has(extension)) {
		return 'text';
	}

	return null;
}

export function normalizeFileInputSelection(selection: FileInputSelection): File[] {
	if (!selection) {
		return [];
	}

	if (typeof (selection as Iterable<File>)[Symbol.iterator] === 'function') {
		return Array.from(selection as Iterable<File>).filter(Boolean);
	}

	if (typeof (selection as ArrayLike<File>).length === 'number') {
		return Array.from(selection as ArrayLike<File>).filter(Boolean);
	}

	return [];
}

export function createFileInputError(
	code: FileInputErrorCode,
	message: string,
	options: Partial<Omit<FileInputError, 'code' | 'message'>> = {}
): FileInputError {
	return {
		code,
		message,
		source: options.source ?? null,
		fileName: options.fileName,
		kind: options.kind,
		cause: options.cause
	};
}

export function toFileInputError(
	error: unknown,
	fallback: FileInputError
): FileInputError {
	if (
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		typeof error.code === 'string' &&
		'message' in error &&
		typeof error.message === 'string'
	) {
		const candidate = error as Partial<FileInputError>;
		return {
			code: candidate.code as FileInputErrorCode,
			message: candidate.message ?? fallback.message,
			source: candidate.source ?? fallback.source,
			fileName: candidate.fileName ?? fallback.fileName,
			kind: candidate.kind ?? fallback.kind,
			cause: candidate.cause ?? fallback.cause
		};
	}

	if (error instanceof Error) {
		return {
			...fallback,
			message: error.message || fallback.message,
			cause: error
		};
	}

	return fallback;
}

export function validateFileInputSelection(
	selection: FileInputSelection,
	allowedKinds: readonly FileInputKind[],
	source: FileInputSource
):
	| { ok: true; file: File; kind: FileInputKind }
	| { ok: false; error: FileInputError } {
	const files = normalizeFileInputSelection(selection);

	if (files.length === 0) {
		return {
			ok: false,
			error: createFileInputError('empty-selection', 'No file was provided for import.', { source })
		};
	}

	if (files.length > 1) {
		return {
			ok: false,
			error: createFileInputError(
				'multiple-files',
				'Only one file can be imported at a time.',
				{ source }
			)
		};
	}

	const [file] = files;
	const kind = inferFileInputKind(file);

	if (!kind || !allowedKinds.includes(kind)) {
		return {
			ok: false,
			error: createFileInputError(
				'unsupported-kind',
				'The selected file type is not supported by this input.',
				{ source, fileName: file.name, kind: kind ?? undefined }
			)
		};
	}

	return { ok: true, file, kind };
}

export function extractDroppedFiles(input: DragEvent | DataTransfer | null | undefined): File[] {
	if (!input) {
		return [];
	}

	const dataTransfer = 'dataTransfer' in input ? input.dataTransfer : input;
	if (!dataTransfer) {
		return [];
	}

	const itemFiles = Array.from(dataTransfer.items ?? [])
		.filter((item) => item.kind === 'file')
		.map((item) => item.getAsFile())
		.filter((file): file is File => Boolean(file));

	if (itemFiles.length > 0) {
		return itemFiles;
	}

	return Array.from(dataTransfer.files ?? []).filter(Boolean);
}

export function getImportedItemObjectUrl(item: ImportedFileItem | null | undefined): string | null {
	if (!item || item.kind === 'text') {
		return null;
	}

	return item.objectUrl;
}