import type {
	FileInputError,
	FileInputKind,
	FileInputSource,
	ImportedFileItem,
	ImportedFileItemBase,
	ImportedImageFileItem,
	ImportedTextFileItem,
	ImportedVideoFileItem
} from '$lib/types/file-input';
import {
	createFileInputError,
	getImportedItemObjectUrl,
	inferFileInputKind,
	toFileInputError
} from './helpers.ts';

export interface ImageMetadata {
	width: number;
	height: number;
}

export interface VideoMetadata extends ImageMetadata {
	duration: number;
}

export interface FileInputReaderDependencies {
	createObjectUrl?: (file: File) => string;
	revokeObjectUrl?: (objectUrl: string) => void;
	loadImageMetadata?: (objectUrl: string) => Promise<ImageMetadata>;
	loadVideoMetadata?: (objectUrl: string) => Promise<VideoMetadata>;
	readText?: (file: File) => Promise<string>;
}

function createBaseItem(file: File, source: FileInputSource, kind: FileInputKind): ImportedFileItemBase {
	return {
		kind,
		source,
		file,
		name: file.name,
		mimeType: file.type,
		size: file.size,
		lastModified: file.lastModified
	};
}

function defaultCreateObjectUrl(file: File): string {
	if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
		throw createFileInputError(
			'picker-unavailable',
			'Object URL APIs are unavailable in the current environment.'
		);
	}

	return URL.createObjectURL(file);
}

function defaultRevokeObjectUrl(objectUrl: string): void {
	if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') {
		return;
	}

	URL.revokeObjectURL(objectUrl);
}

function defaultReadText(file: File): Promise<string> {
	return file.text();
}

function defaultLoadImageMetadata(objectUrl: string): Promise<ImageMetadata> {
	if (typeof Image === 'undefined') {
		return Promise.reject(
			createFileInputError(
				'image-metadata-failed',
				'Image metadata APIs are unavailable in the current environment.'
			)
		);
	}

	return new Promise((resolve, reject) => {
		const image = new Image();

		function cleanup() {
			image.onload = null;
			image.onerror = null;
		}

		image.onload = () => {
			cleanup();
			resolve({
				width: image.naturalWidth || image.width,
				height: image.naturalHeight || image.height
			});
		};

		image.onerror = () => {
			cleanup();
			reject(createFileInputError('image-metadata-failed', 'Failed to read image metadata.'));
		};

		image.src = objectUrl;
	});
}

function defaultLoadVideoMetadata(objectUrl: string): Promise<VideoMetadata> {
	if (typeof document === 'undefined') {
		return Promise.reject(
			createFileInputError(
				'video-metadata-failed',
				'Video metadata APIs are unavailable in the current environment.'
			)
		);
	}

	return new Promise((resolve, reject) => {
		const video = document.createElement('video');
		video.preload = 'metadata';
		video.muted = true;

		function cleanup() {
			video.onloadedmetadata = null;
			video.onerror = null;
			video.pause();
			video.removeAttribute('src');
			video.load();
		}

		video.onloadedmetadata = () => {
			const duration = Number.isFinite(video.duration) ? video.duration : 0;
			cleanup();
			resolve({
				width: video.videoWidth,
				height: video.videoHeight,
				duration
			});
		};

		video.onerror = () => {
			cleanup();
			reject(createFileInputError('video-metadata-failed', 'Failed to read video metadata.'));
		};

		video.src = objectUrl;
		video.load();
	});
}

async function readImageFile(
	file: File,
	source: FileInputSource,
	dependencies: Required<FileInputReaderDependencies>
): Promise<ImportedImageFileItem> {
	const objectUrl = dependencies.createObjectUrl(file);

	try {
		const metadata = await dependencies.loadImageMetadata(objectUrl);
		return {
			...createBaseItem(file, source, 'image'),
			objectUrl,
			width: metadata.width,
			height: metadata.height
		};
	} catch (error) {
		dependencies.revokeObjectUrl(objectUrl);
		throw toFileInputError(
			error,
			createFileInputError('image-metadata-failed', 'Failed to read image metadata.', {
				source,
				fileName: file.name,
				kind: 'image',
				cause: error
			})
		);
	}
}

async function readVideoFile(
	file: File,
	source: FileInputSource,
	dependencies: Required<FileInputReaderDependencies>
): Promise<ImportedVideoFileItem> {
	const objectUrl = dependencies.createObjectUrl(file);

	try {
		const metadata = await dependencies.loadVideoMetadata(objectUrl);
		return {
			...createBaseItem(file, source, 'video'),
			objectUrl,
			width: metadata.width,
			height: metadata.height,
			duration: metadata.duration
		};
	} catch (error) {
		dependencies.revokeObjectUrl(objectUrl);
		throw toFileInputError(
			error,
			createFileInputError('video-metadata-failed', 'Failed to read video metadata.', {
				source,
				fileName: file.name,
				kind: 'video',
				cause: error
			})
		);
	}
}

async function readTextFile(
	file: File,
	source: FileInputSource,
	dependencies: Required<FileInputReaderDependencies>
): Promise<ImportedTextFileItem> {
	try {
		const text = await dependencies.readText(file);
		return {
			...createBaseItem(file, source, 'text'),
			text
		};
	} catch (error) {
		throw toFileInputError(
			error,
			createFileInputError('text-read-failed', 'Failed to read text file content.', {
				source,
				fileName: file.name,
				kind: 'text',
				cause: error
			})
		);
	}
}

export async function readFileInputItem(
	file: File,
	source: FileInputSource,
	dependencies: FileInputReaderDependencies = {}
): Promise<ImportedFileItem> {
	const kind = inferFileInputKind(file);
	if (!kind) {
		throw createFileInputError('unsupported-kind', 'The selected file type is not supported.', {
			source,
			fileName: file.name
		});
	}

	const resolvedDependencies: Required<FileInputReaderDependencies> = {
		createObjectUrl: dependencies.createObjectUrl ?? defaultCreateObjectUrl,
		revokeObjectUrl: dependencies.revokeObjectUrl ?? defaultRevokeObjectUrl,
		loadImageMetadata: dependencies.loadImageMetadata ?? defaultLoadImageMetadata,
		loadVideoMetadata: dependencies.loadVideoMetadata ?? defaultLoadVideoMetadata,
		readText: dependencies.readText ?? defaultReadText
	};

	if (kind === 'image') {
		return readImageFile(file, source, resolvedDependencies);
	}

	if (kind === 'video') {
		return readVideoFile(file, source, resolvedDependencies);
	}

	return readTextFile(file, source, resolvedDependencies);
}

export function revokeImportedFileItem(
	item: ImportedFileItem | null | undefined,
	revokeObjectUrl: (objectUrl: string) => void = defaultRevokeObjectUrl
): void {
	const objectUrl = getImportedItemObjectUrl(item);
	if (!objectUrl) {
		return;
	}

	revokeObjectUrl(objectUrl);
}

export type { FileInputError };