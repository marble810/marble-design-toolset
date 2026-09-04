/**
 * Desktop Asset Input adapter (Main process).
 *
 * The Host chrome asks Main to show the platform file dialog; Main reads the picked
 * file ONCE and keeps the bytes in a session-scoped memory store. The Tool Container
 * receives only `{ kind: 'blob-url', url: 'deshelf-cache://session-assets/<sessionId>/<handle>' }`:
 * an opaque, container-fetchable URL served by the cache protocol handler. Real
 * filesystem paths never cross the seam — neither in the Environment API payloads nor
 * anywhere in the container realm.
 *
 * Bytes are released when the owning session closes.
 */
import { randomUUID } from 'node:crypto';

export interface StoredAsset {
	handle: string;
	sessionId: string;
	mime: string;
	bytes: Uint8Array;
}

export interface PickedFile {
	mime: string;
	/** Raw file contents read by the Main process. */
	bytes: Uint8Array;
}

/** File-dialog contract (structural subset of Electron `Dialog`). */
export interface AssetFileDialog {
	showOpenDialog(options: {
		title?: string;
		filters?: Array<{ name: string; extensions: string[] }>;
		properties: ReadonlyArray<'openFile' | 'openDirectory'>;
	}): Promise<{ canceled: boolean; filePaths?: string[] }>;
}

export class SessionAssetStore {
	private readonly assets = new Map<string, StoredAsset>();

	/** Registers a picked file for a session; returns the opaque handle. */
	store(sessionId: string, picked: PickedFile): StoredAsset {
		const asset: StoredAsset = {
			handle: randomUUID(),
			sessionId,
			mime: picked.mime,
			bytes: picked.bytes
		};
		this.assets.set(asset.handle, asset);
		return asset;
	}

	get(handle: string): StoredAsset | undefined {
		return this.assets.get(handle);
	}

	/** Container-fetchable URL for an asset handle (opaque; no filesystem path). */
	urlFor(handle: string): string | undefined {
		const asset = this.assets.get(handle);
		return asset !== undefined
			? `deshelf-cache://session-assets/${encodeURIComponent(asset.sessionId)}/${handle}`
			: undefined;
	}

	mimeFor(handle: string): string | undefined {
		return this.assets.get(handle)?.mime;
	}

	/** Releases every asset owned by a session (called on close/restart of the realm). */
	releaseSession(sessionId: string): number {
		let released = 0;
		for (const [handle, asset] of this.assets) {
			if (asset.sessionId === sessionId) {
				this.assets.delete(handle);
				released += 1;
			}
		}
		return released;
	}

	get size(): number {
		return this.assets.size;
	}
}

const KIND_FILTERS: Record<string, Array<{ name: string; extensions: string[] }>> = {
	image: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'] }],
	video: [{ name: 'Videos', extensions: ['mp4', 'webm', 'mov'] }],
	audio: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'flac'] }],
	data: [{ name: 'Data', extensions: ['json', 'txt', 'csv', 'bin'] }]
};

const EXTENSION_MIMES: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	webp: 'image/webp',
	gif: 'image/gif',
	bmp: 'image/bmp',
	svg: 'image/svg+xml',
	mp4: 'video/mp4',
	webm: 'video/webm',
	mov: 'video/quicktime',
	mp3: 'audio/mpeg',
	wav: 'audio/wav',
	ogg: 'audio/ogg',
	flac: 'audio/flac',
	json: 'application/json',
	txt: 'text/plain',
	csv: 'text/csv',
	bin: 'application/octet-stream'
};

/** Best-effort mime from the picked file's extension (dialog filters already gate it). */
export function mimeForPath(filePath: string): string {
	const extension = filePath.split('.').pop()?.toLowerCase() ?? '';
	return EXTENSION_MIMES[extension] ?? 'application/octet-stream';
}

/**
 * Asset pick flow: dialog (Host chrome) → read in Main → session store. Returns
 * `undefined` when the user cancels.
 */
export async function pickAsset(
	dialog: AssetFileDialog,
	store: SessionAssetStore,
	sessionId: string,
	request: { title: string; kind?: string }
): Promise<StoredAsset | undefined> {
	const result = await dialog.showOpenDialog({
		title: request.title,
		filters: KIND_FILTERS[request.kind ?? 'data'],
		properties: ['openFile']
	});
	if (result.canceled || result.filePaths === undefined || result.filePaths.length === 0) return undefined;
	const { readFile } = await import('node:fs/promises');
	const pickedPath = result.filePaths[0] as string;
	const bytes = new Uint8Array(await readFile(pickedPath));
	return store.store(sessionId, { mime: mimeForPath(pickedPath), bytes });
}
