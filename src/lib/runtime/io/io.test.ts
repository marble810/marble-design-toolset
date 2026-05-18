import assert from 'node:assert/strict';
import test from 'node:test';

import type { FileInputError, ImportedFileItem } from '../../types/file-input.ts';
import { createFileInputControllerCore } from '../file-input/controller-core.ts';
import { deriveFileInputAccept } from '../file-input/helpers.ts';
import { createToolSourceInputCore, createToolSourceSlotCollectionCore } from './source-core.ts';
import { formatDuration, formatFileSize, summarizeImportedFileItem } from './summary.ts';

test('formatFileSize formats bytes, KB, and MB', () => {
	assert.equal(formatFileSize(12), '12 B');
	assert.equal(formatFileSize(1536), '1.5 KB');
	assert.equal(formatFileSize(2 * 1024 * 1024), '2.0 MB');
});

test('formatDuration formats media duration', () => {
	assert.equal(formatDuration(4.2), '0:04');
	assert.equal(formatDuration(65), '1:05');
});

test('summarizeImportedFileItem creates stable summaries for source UI', () => {
	const file = new File(['pixels'], 'texture.png', { type: 'image/png' });
	const summary = summarizeImportedFileItem({
		kind: 'image',
		source: 'drop',
		file,
		name: file.name,
		mimeType: file.type,
		size: file.size,
		lastModified: file.lastModified,
		objectUrl: 'blob:texture',
		width: 256,
		height: 128
	});

	assert.equal(summary.name, 'texture.png');
	assert.equal(summary.kindLabel, 'Image');
	assert.match(summary.detail, /256 x 128 px/);
});

test('summarizeImportedFileItem creates stable summaries for font source UI', () => {
	const file = new File(['font'], 'display.woff2', { type: 'font/woff2' });
	const summary = summarizeImportedFileItem({
		kind: 'font',
		source: 'picker',
		file,
		name: file.name,
		mimeType: file.type,
		size: file.size,
		lastModified: file.lastModified,
		arrayBuffer: new ArrayBuffer(4),
		dataUrl: 'data:font/woff2;base64,AAAA'
	});

	assert.equal(summary.kindLabel, 'Font');
	assert.match(summary.detail, /Font file/);
});

test('tool source facade delegates validation, reading, drop state, and cleanup to file-input controller', async () => {
	const revoked: string[] = [];
	let busy = false;
	let currentItem: ImportedFileItem | null = null;
	let lastError: FileInputError | null = null;
	let isDragOver = false;
	const pickedText = new File(['hello'], 'notes.txt', { type: 'text/plain' });
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
			pickFiles: async () => [pickedText],
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
						width: 640,
						height: 360
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
					text: 'hello'
				};
			},
			dependencies: {},
			revokeObjectUrl: (objectUrl) => revoked.push(objectUrl)
		}
	);
	const source = createToolSourceInputCore(controller, {
		getIsDragOver: () => isDragOver,
		setIsDragOver: (value) => {
			isDragOver = value;
		}
	});

	const firstImage = new File(['pixels-1'], 'first.png', { type: 'image/png' });
	const secondImage = new File(['pixels-2'], 'second.png', { type: 'image/png' });
	const unsupportedVideo = new File(['video'], 'clip.mp4', { type: 'video/mp4' });

	assert.equal(source.accept, deriveFileInputAccept(['image', 'text']));
	assert.deepEqual(source.allowedKinds, ['image', 'text']);

	const firstResult = await source.ingestDrop([firstImage]);
	assert.equal(firstResult?.kind, 'image');
	assert.equal(firstResult?.source, 'drop');
	assert.equal(source.currentItem?.name, 'first.png');
	assert.match(source.summary?.detail ?? '', /640 x 360 px/);

	const failedResult = await source.ingestDrop([unsupportedVideo]);
	assert.equal(failedResult, null);
	assert.equal(source.currentItem?.name, 'first.png');
	assert.equal(source.lastError?.code, 'unsupported-kind');
	assert.deepEqual(revoked, []);

	source.handleDragOver({ preventDefault: () => {} } as DragEvent);
	assert.equal(source.isDragOver, true);

	const droppedResult = await source.handleDrop({
		preventDefault: () => {},
		dataTransfer: {
			items: [{ kind: 'file', getAsFile: () => secondImage }],
			files: []
		}
	} as unknown as DragEvent);
	assert.equal(droppedResult?.name, 'second.png');
	assert.equal(source.isDragOver, false);
	assert.deepEqual(revoked, ['blob:first.png']);

	const pickedResult = await source.pick();
	assert.equal(pickedResult?.kind, 'text');
	assert.equal(pickedResult?.source, 'picker');
	assert.equal(source.currentItem?.name, 'notes.txt');
	assert.deepEqual(revoked, ['blob:first.png', 'blob:second.png']);

	source.clear();
	assert.equal(source.currentItem, null);
	assert.equal(source.lastError, null);
	assert.deepEqual(revoked, ['blob:first.png', 'blob:second.png']);
});

test('tool source slot collection routes ingest and drag state per slot', async () => {
	const heroFile = new File(['hero'], 'hero.png', { type: 'image/png' });
	const logoFile = new File(['logo'], 'logo.png', { type: 'image/png' });
	const slotItems = new Map<string, ImportedFileItem | null>([
		['hero', null],
		['logo', null]
	]);
	const dragState = new Map<string, boolean>();
	const makeSlot = (id: string, name: string) => ({
		id,
		name,
		desc: `${name} description`,
		required: id === 'hero',
		maxSizeMB: 4,
		accept: 'image/*',
		allowedKinds: ['image'] as const,
		get busy() {
			return false;
		},
		get currentItem() {
			return slotItems.get(id) ?? null;
		},
		get lastError() {
			return null;
		},
		pick: async () => null,
		ingestFiles: async (selection: Iterable<File>) => {
			const [file] = Array.from(selection);
			const item: ImportedFileItem = {
				kind: 'image',
				source: 'drop',
				file,
				name: file.name,
				mimeType: file.type,
				size: file.size,
				lastModified: file.lastModified,
				objectUrl: `blob:${file.name}`,
				width: 100,
				height: 100
			};
			slotItems.set(id, item);
			return item;
		},
		clear: () => slotItems.set(id, null),
		dispose: () => slotItems.set(id, null)
	});
	const source = createToolSourceSlotCollectionCore(
		{
			mode: 'slots',
			slots: [makeSlot('hero', 'Hero Image'), makeSlot('logo', 'Logo Image')],
			getSlot: (id) => source.slots.find((slot) => slot.id === id) ?? null,
			clear: () => {},
			dispose: () => {}
		},
		{
			getIsDragOver: (slotId) => dragState.get(slotId) ?? false,
			setIsDragOver: (slotId, value) => dragState.set(slotId, value)
		}
	);

	await source.getSlot('hero')?.ingestDrop([heroFile]);
	assert.equal(source.getSlot('hero')?.currentItem?.name, 'hero.png');
	assert.equal(source.getSlot('logo')?.currentItem, null);

	await source.getSlot('logo')?.handleDrop({
		preventDefault: () => {},
		dataTransfer: {
			items: [{ kind: 'file', getAsFile: () => logoFile }],
			files: []
		}
	} as unknown as DragEvent);
	assert.equal(source.getSlot('logo')?.currentItem?.name, 'logo.png');

	source.getSlot('hero')?.handleDragOver({ preventDefault: () => {} } as DragEvent);
	assert.equal(source.getSlot('hero')?.isDragOver, true);
	assert.equal(source.getSlot('logo')?.isDragOver, false);
});
