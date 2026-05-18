import assert from 'node:assert/strict';
import test from 'node:test';

import { createFileInputControllerCore } from './controller-core.ts';
import {
	deriveFileInputAccept,
	extractDroppedFiles,
	inferFileInputKind,
	validateFileInputSelection
} from './helpers.ts';
import { readFileInputItem } from './readers.ts';

test('deriveFileInputAccept deduplicates accept patterns in stable kind order', () => {
	assert.equal(
		deriveFileInputAccept(['text', 'image', 'text']),
		'image/*,.png,.jpg,.jpeg,.webp,.gif,.bmp,.avif,.svg,text/*,.txt,.md,.csv,.json,.yaml,.yml,.xml'
	);
});

test('inferFileInputKind resolves image, video, and text from mime or extension', () => {
	assert.equal(inferFileInputKind(new File(['pixels'], 'texture.png', { type: 'image/png' })), 'image');
	assert.equal(inferFileInputKind(new File(['video'], 'clip.webm', { type: 'video/webm' })), 'video');
	assert.equal(inferFileInputKind(new File(['hello'], 'notes.md', { type: '' })), 'text');
	assert.equal(inferFileInputKind(new File(['font'], 'display.woff2', { type: '' })), 'font');
	assert.equal(inferFileInputKind(new File(['bytes'], 'archive.bin', { type: 'application/octet-stream' })), null);
});

test('extractDroppedFiles prefers item files and validateFileInputSelection returns stable errors', () => {
	const note = new File(['hello'], 'notes.txt', { type: 'text/plain' });
	const image = new File(['pixels'], 'texture.png', { type: 'image/png' });
	const dropped = extractDroppedFiles({
		items: [
			{ kind: 'string', getAsFile: () => null },
			{ kind: 'file', getAsFile: () => note },
			{ kind: 'file', getAsFile: () => image }
		],
		files: []
	} as unknown as DataTransfer);

	assert.deepEqual(dropped, [note, image]);
	assert.deepEqual(validateFileInputSelection([], ['image'], 'drop'), {
		ok: false,
		error: {
			code: 'empty-selection',
			message: 'No file was provided for import.',
			source: 'drop',
			fileName: undefined,
			kind: undefined,
			cause: undefined
		}
	});
	assert.equal(validateFileInputSelection(dropped, ['image'], 'drop').ok, false);
});

test('readFileInputItem normalizes text, image, and video inputs through injected readers', async () => {
	const textFile = new File(['hello'], 'notes.md', { type: 'text/markdown' });
	const imageFile = new File(['pixels'], 'texture.png', { type: 'image/png' });
	const videoFile = new File(['video'], 'clip.mp4', { type: 'video/mp4' });

	const textItem = await readFileInputItem(textFile, 'picker', {
		readText: async () => 'hello'
	});
	const imageItem = await readFileInputItem(imageFile, 'drop', {
		createObjectUrl: () => 'blob:image',
		loadImageMetadata: async () => ({ width: 320, height: 180 }),
		revokeObjectUrl: () => {}
	});
	const videoItem = await readFileInputItem(videoFile, 'drop', {
		createObjectUrl: () => 'blob:video',
		loadVideoMetadata: async () => ({ width: 1920, height: 1080, duration: 4.2 }),
		revokeObjectUrl: () => {}
	});

	assert.deepEqual(textItem, {
		kind: 'text',
		source: 'picker',
		file: textFile,
		name: 'notes.md',
		mimeType: 'text/markdown',
		size: textFile.size,
		lastModified: textFile.lastModified,
		text: 'hello'
	});
	assert.equal(imageItem.kind, 'image');
	assert.equal(imageItem.objectUrl, 'blob:image');
	assert.equal(imageItem.width, 320);
	assert.equal(videoItem.kind, 'video');
	assert.equal(videoItem.objectUrl, 'blob:video');
	assert.equal(videoItem.duration, 4.2);
});

test('readFileInputItem normalizes font inputs through injected readers', async () => {
	const fontFile = new File(['font-bytes'], 'display.woff2', { type: 'font/woff2' });
	const item = await readFileInputItem(fontFile, 'picker', {
		readFont: async () => ({
			arrayBuffer: new ArrayBuffer(4),
			dataUrl: 'data:font/woff2;base64,AAAA'
		})
	});

	assert.equal(item.kind, 'font');
	assert.equal(item.name, 'display.woff2');
	assert.equal(item.dataUrl, 'data:font/woff2;base64,AAAA');
});

test('validateFileInputSelection rejects files above maxSizeBytes without clearing callers', () => {
	const file = new File(['12345'], 'display.woff2', { type: 'font/woff2' });
	const result = validateFileInputSelection([file], ['font'], 'drop', { maxSizeBytes: 2 });
	assert.equal(result.ok, false);
	if (!result.ok) {
		assert.equal(result.error.code, 'max-size-exceeded');
		assert.equal(result.error.kind, 'font');
	}
});

test('createFileInputController preserves last success and revokes object URLs on replacement and cleanup', async () => {
	const revoked: string[] = [];
	let busy = false;
	let currentItem = null;
	let lastError = null;
	const controller = createFileInputControllerCore(
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
			accept: deriveFileInputAccept(['image', 'text']),
			allowedKinds: ['image', 'text'],
			pickFiles: async () => [],
		readItem: async (file, source) => {
			if (file.type.startsWith('image/')) {
				return {
					kind: 'image',
					source,
					file,
					name: file.name,
					mimeType: file.type,
					size: file.size,
					lastModified: file.lastModified,
					objectUrl: `blob:${file.name}`,
					width: 256,
					height: 256
				};
			}

			return {
				kind: 'text',
				source,
				file,
				name: file.name,
				mimeType: file.type,
				size: file.size,
				lastModified: file.lastModified,
				text: 'stub'
			};
		},
			dependencies: {},
		revokeObjectUrl: (objectUrl) => revoked.push(objectUrl)
		}
	);

	const firstImage = new File(['pixels-1'], 'first.png', { type: 'image/png' });
	const secondImage = new File(['pixels-2'], 'second.png', { type: 'image/png' });
	const unsupportedVideo = new File(['video'], 'clip.mp4', { type: 'video/mp4' });

	const firstResult = await controller.ingestFiles([firstImage], 'drop');
	assert.equal(firstResult?.kind, 'image');
	assert.equal(controller.currentItem?.name, 'first.png');
	assert.equal(controller.lastError, null);
	assert.equal(controller.busy, false);

	const failedResult = await controller.ingestFiles([unsupportedVideo], 'drop');
	assert.equal(failedResult, null);
	assert.equal(controller.currentItem?.name, 'first.png');
	assert.equal(controller.lastError?.code, 'unsupported-kind');
	assert.equal(controller.busy, false);

	await controller.ingestFiles([secondImage], 'picker');
	assert.equal(controller.currentItem?.name, 'second.png');
	assert.deepEqual(revoked, ['blob:first.png']);

	controller.clear();
	assert.equal(controller.currentItem, null);
	assert.equal(controller.lastError, null);
	assert.equal(controller.busy, false);
	assert.deepEqual(revoked, ['blob:first.png', 'blob:second.png']);

	await controller.ingestFiles([firstImage], 'drop');
	controller.dispose();
	assert.deepEqual(revoked, ['blob:first.png', 'blob:second.png', 'blob:first.png']);
});
