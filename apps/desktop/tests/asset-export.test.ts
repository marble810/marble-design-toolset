/**
 * Desktop Asset Input / Visual Output adapter tests:
 * - session-scoped opaque handles, no filesystem paths;
 * - export flow: data: decode, container blob: resolution, cancel/error paths.
 */
import { describe, expect, test } from 'bun:test';
import os from 'node:os';
import path from 'node:path';
import { SessionAssetStore, pickAsset, type AssetFileDialog } from '../src/main/asset-store.ts';
import { resolveExportBytes, saveExport, type SaveFileDialog } from '../src/main/export-writer.ts';

describe('SessionAssetStore', () => {
	test('stores per session, resolves opaque URLs, releases on close', () => {
		const store = new SessionAssetStore();
		const a = store.store('s1', { mime: 'image/png', bytes: new Uint8Array([1, 2, 3]) });
		store.store('s2', { mime: 'image/png', bytes: new Uint8Array([4]) });

		expect(a.handle).toMatch(/[0-9a-f-]{36}/);
		expect(store.urlFor(a.handle)).toBe(`deshelf-cache://session-assets/s1/${a.handle}`);
		expect(store.urlFor('missing')).toBeUndefined();
		expect(store.size).toBe(2);

		expect(store.releaseSession('s1')).toBe(1);
		expect(store.get(a.handle)).toBeUndefined();
		expect(store.size).toBe(1);
	});
});

describe('pickAsset', () => {
	test('cancel path returns undefined', async () => {
		const dialog: AssetFileDialog = { showOpenDialog: async () => ({ canceled: true }) };
		expect(await pickAsset(dialog, new SessionAssetStore(), 's1', { title: 'pick' })).toBeUndefined();
	});

	test('picked file bytes stay in Main and get an opaque handle', async () => {
		const { writeFile, mkdtemp } = await import('node:fs/promises');
		const tmp = await mkdtemp(path.join(os.tmpdir(), 'deshelf-desktop-asset-'));
		const file = path.join(tmp, 'photo.png');
		await writeFile(file, Buffer.from([137, 80, 78, 71]));
		const dialog: AssetFileDialog = {
			showOpenDialog: async () => ({ canceled: false, filePaths: [file] })
		};
		const store = new SessionAssetStore();
		const picked = await pickAsset(dialog, store, 's1', { title: 'pick' });
		expect(picked?.handle).toBeDefined();
		// The handle must never contain the path.
		expect(picked?.handle?.includes(tmp)).toBe(false);
		expect(store.urlFor(picked?.handle ?? '')).toContain('session-assets/');
		expect([...(store.get(picked?.handle ?? '')?.bytes ?? [])]).toEqual([137, 80, 78, 71]);
	});
});

describe('export writer', () => {
	test('decodes base64 data URLs', async () => {
		const bytes = await resolveExportBytes(
			{ kind: 'blob-url', url: 'data:image/png;base64,' + Buffer.from([137, 80, 78, 71]).toString('base64') },
			'image/png',
			async () => {
				throw new Error('must not resolve blobs for data URLs');
			}
		);
		expect([...(bytes ?? [])]).toEqual([137, 80, 78, 71]);
	});

	test('resolves container blob: URLs through the container realm', async () => {
		const dataUrl = 'data:image/png;base64,' + Buffer.from('pngdata').toString('base64');
		const bytes = await resolveExportBytes({ kind: 'blob-url', url: 'blob:deshelf-cache/abc' }, 'image/png', async () => dataUrl);
		expect(new TextDecoder().decode(bytes)).toBe('pngdata');
	});

	test('unknown content resolves to undefined', async () => {
		expect(await resolveExportBytes({ kind: 'empty' }, 'image/png', async () => 'data:text/plain;base64,aGk=')).toBeUndefined();
	});

	test('saveExport: canceled dialog', async () => {
		const dialog: SaveFileDialog = { showSaveDialog: async () => ({ canceled: true }) };
		const result = await saveExport({
			content: { kind: 'blob-url', url: 'data:image/png;base64,aGk=' },
			mime: 'image/png',
			suggestedName: 'frame',
			dialog,
			resolveBlob: async () => {
				throw new Error('unreachable');
			}
		});
		expect(result).toEqual({ ok: false, canceled: true });
	});

	test('saveExport: writes decoded bytes to the chosen path', async () => {
		const written: Array<{ path: string; bytes: Uint8Array }> = [];
		const dialog: SaveFileDialog = { showSaveDialog: async () => ({ canceled: false, filePath: 'C:/out/frame.png' }) };
		const result = await saveExport({
			content: { kind: 'blob-url', url: 'data:image/png;base64,aGVsbG8=' },
			mime: 'image/png',
			suggestedName: 'frame',
			dialog,
			resolveBlob: async () => {
				throw new Error('unreachable');
			},
			writeFile: async (target, data) => {
				written.push({ path: String(target), bytes: new Uint8Array(data as unknown as ArrayBuffer) });
			}
		});
		expect(result.ok).toBe(true);
		expect(written[0].path).toBe('C:/out/frame.png');
		expect(new TextDecoder().decode(written[0].bytes)).toBe('hello');
	});
});
