import type {
	CanvasExporterDescriptor,
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

async function rasterDomKind(args: RasterArgs): Promise<Blob> {
	if (args.descriptor.kind !== 'dom') {
		throw new Error('rasterDomKind requires kind=dom');
	}
	const element = args.descriptor.getElement();
	if (!element) {
		throw new Error('Source DOM element is not available');
	}
	const width = args.contentWidth * args.scale;
	const height = args.contentHeight * args.scale;

	const cloned = element.cloneNode(true) as HTMLElement;
	const xmlSerializer = new XMLSerializer();
	const svgNs = 'http://www.w3.org/2000/svg';
	const svg = document.createElementNS(svgNs, 'svg');
	svg.setAttribute('xmlns', svgNs);
	svg.setAttribute('width', String(width));
	svg.setAttribute('height', String(height));
	svg.setAttribute('viewBox', `0 0 ${args.contentWidth} ${args.contentHeight}`);
	const fo = document.createElementNS(svgNs, 'foreignObject');
	fo.setAttribute('x', '0');
	fo.setAttribute('y', '0');
	fo.setAttribute('width', String(args.contentWidth));
	fo.setAttribute('height', String(args.contentHeight));
	fo.appendChild(cloned);
	svg.appendChild(fo);

	const svgString = xmlSerializer.serializeToString(svg);
	const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
	const url = URL.createObjectURL(svgBlob);
	try {
		const image = new Image();
		await new Promise<void>((resolve, reject) => {
			image.onload = () => resolve();
			image.onerror = () => reject(new Error('Failed to load DOM snapshot SVG'));
			image.src = url;
		});
		const target = createOffscreen(width, height);
		const ctx = target.getContext('2d');
		if (!ctx) {
			throw new Error('Failed to acquire 2D context');
		}
		ctx.drawImage(image, 0, 0, width, height);
		return await blobFromCanvas(target);
	} finally {
		URL.revokeObjectURL(url);
	}
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
		return {
			ok: true,
			filename,
			mime: 'image/png',
			extension: 'png',
			bitDepth: 8
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
