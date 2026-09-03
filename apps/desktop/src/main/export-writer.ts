/**
 * Desktop Visual Output export adapter (Main process).
 *
 * The Tool Container renders an export inside its own realm and returns serializable
 * content (`data:` URL, or a `blob:` URL owned by the container realm). Main resolves
 * the bytes — container-owned blob URLs through the container realm itself — then shows
 * the platform save dialog and writes the file. Real filesystem paths never enter the
 * Tool Container: the container only ever sees a serializable export result.
 */
import { promises as fs } from 'node:fs';

export interface SaveFileDialog {
	showSaveDialog(options: {
		title?: string;
		defaultPath?: string;
		filters?: Array<{ name: string; extensions: string[] }>;
	}): Promise<{ canceled: boolean; filePath?: string }>;
}

/** Resolves a container-owned `blob:` URL into a data URL (runs inside the container realm). */
export type ContainerBlobResolver = (blobUrl: string) => Promise<string>;

export interface ExportContentInput {
	kind: string;
	url?: string;
	data?: string;
}

export interface ExportSaveOutcome {
	ok: boolean;
	canceled?: boolean;
	error?: string;
}

const MIME_EXTENSIONS: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/webp': 'webp',
	'image/gif': 'gif',
	'video/mp4': 'mp4',
	'video/webm': 'webm',
	'audio/wav': 'wav',
	'audio/mpeg': 'mp3',
	'application/json': 'json',
	'text/plain': 'txt'
};

function extensionFor(mime: string, suggestedName: string): string {
	if (suggestedName.includes('.')) return '';
	return MIME_EXTENSIONS[mime] ?? 'bin';
}

/** Decodes `data:`/`blob:` export content into bytes (Main-side, never in the container). */
export async function resolveExportBytes(
	content: ExportContentInput,
	mime: string,
	resolveBlob: ContainerBlobResolver
): Promise<Uint8Array | undefined> {
	if (typeof content.data === 'string' && content.data.startsWith('data:')) {
		return decodeDataUrl(content.data);
	}
	if (typeof content.url === 'string' && content.url.startsWith('data:')) {
		return decodeDataUrl(content.url);
	}
	if (typeof content.url === 'string' && content.url.startsWith('blob:')) {
		// The blob lives in the container realm; resolve it there into a data URL first.
		return decodeDataUrl(await resolveBlob(content.url));
	}
	return undefined;
}

function decodeDataUrl(dataUrl: string): Uint8Array | undefined {
	const commaIndex = dataUrl.indexOf(',');
	if (!dataUrl.startsWith('data:') || commaIndex < 0) return undefined;
	const meta = dataUrl.slice(5, commaIndex);
	const payload = dataUrl.slice(commaIndex + 1);
	if (meta.includes(';base64')) {
		return new Uint8Array(Buffer.from(payload, 'base64'));
	}
	return new Uint8Array(Buffer.from(decodeURIComponent(payload), 'utf8'));
}

/** Full Desktop export flow: resolve bytes → save dialog → write to disk. */
export async function saveExport(input: {
	content: ExportContentInput;
	mime: string;
	suggestedName: string;
	dialog: SaveFileDialog;
	resolveBlob: ContainerBlobResolver;
	writeFile?: typeof fs.writeFile;
}): Promise<ExportSaveOutcome> {
	const extension = extensionFor(input.mime, input.suggestedName);
	const filters = [{ name: input.mime, extensions: [extension.replace(/^\./, '') || 'bin'] }];
	const result = await input.dialog.showSaveDialog({
		title: 'Export Visual Output',
		defaultPath: extension !== '' ? `${input.suggestedName}.${extension}` : input.suggestedName,
		filters
	});
	if (result.canceled || result.filePath === undefined) return { ok: false, canceled: true };
	const bytes = await resolveExportBytes(input.content, input.mime, input.resolveBlob);
	if (bytes === undefined) {
		return { ok: false, error: 'export content could not be resolved into bytes' };
	}
	try {
		const write = input.writeFile ?? fs.writeFile;
		await write(result.filePath, bytes);
		return { ok: true };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : String(err) };
	}
}
