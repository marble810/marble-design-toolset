import type {
	CanvasExporterDescriptor,
	CanvasExporterDomOptions,
	PngExportOptions,
	ExportResult,
	ResolvedCapabilities
} from '$lib/types/canvas-export';
import { triggerDownload } from './download.ts';

interface RasterArgs {
	descriptor: CanvasExporterDescriptor;
	contentWidth: number;
	contentHeight: number;
	scale: 1 | 2 | 4;
}

function createOffscreen(width: number, height: number): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.floor(width));
	canvas.height = Math.max(1, Math.floor(height));
	return canvas;
}

async function blobFromCanvas(canvas: HTMLCanvasElement, mime = 'image/png'): Promise<Blob> {
	return await new Promise<Blob>((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (!blob) {
				reject(new Error('canvas.toBlob returned null'));
				return;
			}
			resolve(blob);
		}, mime);
	});
}

async function rasterCanvasKind(args: RasterArgs): Promise<Blob> {
	if (args.descriptor.kind !== 'canvas') {
		throw new Error('rasterCanvasKind requires kind=canvas');
	}
	const source = args.descriptor.getCanvas();
	if (!source) {
		throw new Error('Source canvas is not available');
	}
	const target = createOffscreen(args.contentWidth * args.scale, args.contentHeight * args.scale);
	const ctx = target.getContext('2d');
	if (!ctx) {
		throw new Error('Failed to acquire 2D context');
	}
	ctx.imageSmoothingEnabled = false;
	ctx.drawImage(source, 0, 0, target.width, target.height);
	return blobFromCanvas(target);
}

async function rasterRenderKind(args: RasterArgs): Promise<Blob> {
	if (args.descriptor.kind !== 'render') {
		throw new Error('rasterRenderKind requires kind=render');
	}
	const target = createOffscreen(args.contentWidth * args.scale, args.contentHeight * args.scale);
	await args.descriptor.renderFrame({ canvas: target, time: 0, frameIndex: 0 });
	return blobFromCanvas(target);
}

type HtmlToImageModule = typeof import('html-to-image');

let htmlToImageForTests: HtmlToImageModule | null = null;

async function loadHtmlToImage(): Promise<HtmlToImageModule> {
	return htmlToImageForTests ?? await import('html-to-image');
}

export function __setHtmlToImageForTests(module: HtmlToImageModule | null): void {
	htmlToImageForTests = module;
}

function mapDomExportOptions(options: CanvasExporterDomOptions | undefined): CanvasExporterDomOptions {
	const filter = options?.filter
		? (node: HTMLElement) => {
				if (typeof Element === 'undefined' || !(node instanceof Element)) {
					return true;
				}

				return options.filter?.(node) ?? true;
			}
		: undefined;

	return {
		backgroundColor: options?.backgroundColor,
		filter,
		cacheBust: options?.cacheBust,
		style: options?.style,
		fontEmbedCSS: options?.fontEmbedCSS
	};
}

async function rasterDomKind(args: RasterArgs): Promise<Blob> {
	if (args.descriptor.kind !== 'dom') {
		throw new Error('rasterDomKind requires kind=dom');
	}
	const element = args.descriptor.getElement();
	if (!element) {
		throw new Error('Source DOM element is not available');
	}
	const htmlToImage = await loadHtmlToImage();
	const blob = await htmlToImage.toBlob(element, {
		width: args.contentWidth,
		height: args.contentHeight,
		canvasWidth: args.contentWidth * args.scale,
		canvasHeight: args.contentHeight * args.scale,
		pixelRatio: args.scale,
		...mapDomExportOptions(args.descriptor.domOptions)
	});

	if (!blob) {
		throw new Error('DOM snapshot returned no PNG data');
	}

	return blob;
}

export async function exportPng8(args: {
	descriptor: CanvasExporterDescriptor;
	contentWidth: number;
	contentHeight: number;
	options: PngExportOptions;
}): Promise<ExportResult> {
	const { descriptor, contentWidth, contentHeight, options } = args;
	const filename = `${options.filename || 'export'}.png`;
	try {
		const rasterArgs: RasterArgs = {
			descriptor,
			contentWidth,
			contentHeight,
			scale: options.scale
		};
		let blob: Blob;
		if (descriptor.kind === 'canvas') {
			blob = await rasterCanvasKind(rasterArgs);
		} else if (descriptor.kind === 'render') {
			blob = await rasterRenderKind(rasterArgs);
		} else {
			blob = await rasterDomKind(rasterArgs);
		}
		triggerDownload(blob, filename);
		const warnings = descriptor.kind === 'dom' ? [...(descriptor.getWarnings?.() ?? [])] : [];
		return {
			ok: true,
			filename,
			mime: 'image/png',
			extension: 'png',
			bitDepth: 8,
			warnings: warnings.length ? warnings : undefined
		};
	} catch (err) {
		return {
			ok: false,
			error: err instanceof Error ? err.message : String(err)
		};
	}
}

/** Returns whether the given exporter can be invoked for PNG export at all. */
export function canExportPng(resolved: ResolvedCapabilities): boolean {
	return resolved.png;
}
