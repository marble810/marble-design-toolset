import type {
	CanvasExporterDescriptor,
	ExportResult,
	PngExportOptions,
	Pixels16Buffer
} from '$lib/types/canvas-export';
import { triggerDownload } from './download.ts';

type FastPngModule = typeof import('fast-png');

let fastPngPromise: Promise<FastPngModule> | null = null;

/**
 * Lazily load the `fast-png` module. The module MUST NOT be statically imported
 * anywhere else in the codebase.
 */
export function loadFastPng(): Promise<FastPngModule> {
	if (!fastPngPromise) {
		fastPngPromise = import('fast-png');
	}
	return fastPngPromise;
}

/** For tests only. */
export function __resetFastPngForTests(): void {
	fastPngPromise = null;
}

/** For tests only — inject a fake module. */
export function __setFastPngForTests(mod: FastPngModule): void {
	fastPngPromise = Promise.resolve(mod);
}

export interface EncodePng16Args {
	data: Uint16Array;
	width: number;
	height: number;
	channels: 3 | 4;
}

export async function encodePng16(args: EncodePng16Args): Promise<Blob> {
	const { encode } = await loadFastPng();
	const encoded = encode({
		data: args.data,
		width: args.width,
		height: args.height,
		depth: 16,
		channels: args.channels
	});
	const buffer =
		encoded instanceof Uint8Array
			? encoded.slice().buffer
			: (encoded as ArrayBuffer);
	return new Blob([buffer], { type: 'image/png' });
}

async function getPixels16(
	descriptor: CanvasExporterDescriptor
): Promise<Pixels16Buffer | null> {
	if (descriptor.kind === 'canvas') {
		return descriptor.getPixels16?.() ?? null;
	}
	if (descriptor.kind === 'render') {
		if (!descriptor.renderFrame16) {
			return null;
		}
		return await descriptor.renderFrame16({ time: 0, frameIndex: 0 });
	}
	return null;
}

export async function exportPng16(args: {
	descriptor: CanvasExporterDescriptor;
	options: PngExportOptions;
}): Promise<ExportResult> {
	const { descriptor, options } = args;
	const filename = `${options.filename || 'export'}.png`;
	try {
		const pixels = await getPixels16(descriptor);
		if (!pixels) {
			return {
				ok: false,
				error: 'Exporter did not provide 16-bit pixel data'
			};
		}
		const blob = await encodePng16({
			data: pixels.data,
			width: pixels.width,
			height: pixels.height,
			channels: pixels.channels
		});
		triggerDownload(blob, filename);
		return {
			ok: true,
			filename,
			mime: 'image/png',
			extension: 'png',
			bitDepth: 16,
			notice:
				'16-bit PNG: many in-browser viewers downscale to 8-bit. Use a professional image tool (Photoshop, Affinity, macOS Preview) to inspect at full depth.'
		};
	} catch (err) {
		return {
			ok: false,
			error: err instanceof Error ? err.message : String(err)
		};
	}
}
