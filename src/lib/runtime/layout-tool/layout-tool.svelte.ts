import { onDestroy } from 'svelte';
import type { CanvasExporterDomOptions } from '$lib/types/canvas-export';
import type { FileInputSourceSlotDefinition, ImportedFontFileItem } from '$lib/types/file-input';
import { getCanvasExportContext } from '$lib/runtime/canvas-export/context';
import {
	createToolSourceSlotCollection,
	type ToolSourceSlotCollection
} from '$lib/runtime/io/index.js';
import {
	createGoogleFontsBrowseUrl,
	parseGoogleFontUrlInput,
	type ParsedGoogleFontUrl
} from './google-fonts.ts';

export type { ParsedGoogleFontUrl } from './google-fonts.ts';

export interface LayoutToolSizeOptions {
	defaultWidth: number;
	defaultHeight: number;
	minWidth: number;
	maxWidth: number;
	minHeight: number;
	maxHeight: number;
}

export interface LayoutToolSourcesOptions {
	slots: readonly FileInputSourceSlotDefinition[];
}

export interface LayoutToolFontsOptions {
	defaultFamily?: string;
	systemFallback?: string;
	googleWeights?: readonly number[];
}

export interface LayoutToolExportOptions {
	id?: string;
	label?: string;
	getElement: () => HTMLElement | null;
	domOptions?: CanvasExporterDomOptions;
}

export interface LayoutToolControllerOptions {
	size: LayoutToolSizeOptions;
	sources: LayoutToolSourcesOptions;
	fonts: LayoutToolFontsOptions;
	export: LayoutToolExportOptions;
}

export interface LayoutToolDiagnostic {
	id: string;
	tone: 'info' | 'warning';
	message: string;
}

export interface LayoutToolSizeController {
	readonly widthInput: string;
	readonly heightInput: string;
	readonly contentWidth: number;
	readonly contentHeight: number;
	readonly diagnostics: readonly LayoutToolDiagnostic[];
	setWidthInput: (value: string) => void;
	setHeightInput: (value: string) => void;
	reset: () => void;
}

export interface LayoutToolFontController {
	readonly family: string;
	readonly fontFaceCss: string;
	readonly loading: boolean;
	readonly warning: string;
	readonly diagnostics: readonly LayoutToolDiagnostic[];
	getGoogleFontsBrowseUrl: (input?: string) => string;
	loadGoogleFont: (family: string) => Promise<void>;
	loadGoogleFontFromUrl: (input: string) => Promise<ParsedGoogleFontUrl | null>;
	useUploadedFont: (slotId: string, family?: string) => Promise<void>;
	reset: () => void;
}

export interface LayoutToolController {
	readonly size: LayoutToolSizeController;
	readonly sources: ToolSourceSlotCollection;
	readonly fonts: LayoutToolFontController;
	readonly diagnostics: readonly LayoutToolDiagnostic[];
	dispose: () => void;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function parseDimension(input: string, fallback: number): number {
	const parsed = Number.parseInt(input, 10);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function cssString(value: string): string {
	return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function bytesToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	const chunkSize = 0x8000;
	for (let index = 0; index < bytes.length; index += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
	}
	return btoa(binary);
}

async function responseToDataUrl(response: Response): Promise<string> {
	const contentType = response.headers.get('content-type') ?? 'font/woff2';
	const buffer = await response.arrayBuffer();
	return `data:${contentType};base64,${bytesToBase64(buffer)}`;
}

function createSizeController(options: LayoutToolSizeOptions): LayoutToolSizeController {
	let widthInput = $state(String(options.defaultWidth));
	let heightInput = $state(String(options.defaultHeight));
	const widthValue = $derived(
		clamp(parseDimension(widthInput, options.defaultWidth), options.minWidth, options.maxWidth)
	);
	const heightValue = $derived(
		clamp(parseDimension(heightInput, options.defaultHeight), options.minHeight, options.maxHeight)
	);
	const diagnostics = $derived.by<LayoutToolDiagnostic[]>(() => {
		const next: LayoutToolDiagnostic[] = [];
		const rawWidth = Number.parseInt(widthInput, 10);
		const rawHeight = Number.parseInt(heightInput, 10);
		if (!Number.isFinite(rawWidth) || rawWidth < options.minWidth || rawWidth > options.maxWidth) {
			next.push({
				id: 'layout-width-out-of-range',
				tone: 'warning',
				message: `Width must be between ${options.minWidth}px and ${options.maxWidth}px.`
			});
		}
		if (!Number.isFinite(rawHeight) || rawHeight < options.minHeight || rawHeight > options.maxHeight) {
			next.push({
				id: 'layout-height-out-of-range',
				tone: 'warning',
				message: `Height must be between ${options.minHeight}px and ${options.maxHeight}px.`
			});
		}
		return next;
	});

	return {
		get widthInput() {
			return widthInput;
		},
		get heightInput() {
			return heightInput;
		},
		get contentWidth() {
			return widthValue;
		},
		get contentHeight() {
			return heightValue;
		},
		get diagnostics() {
			return diagnostics;
		},
		setWidthInput: (value) => {
			widthInput = value;
		},
		setHeightInput: (value) => {
			heightInput = value;
		},
		reset: () => {
			widthInput = String(options.defaultWidth);
			heightInput = String(options.defaultHeight);
		}
	};
}

function createFontController(
	options: LayoutToolFontsOptions,
	sources: ToolSourceSlotCollection
): LayoutToolFontController {
	const fallback = options.systemFallback ?? 'system-ui, sans-serif';
	let family = $state(options.defaultFamily ?? fallback);
	let fontFaceCss = $state('');
	let warning = $state('');
	let loading = $state(false);
	let styleElement: HTMLStyleElement | null = null;

	const diagnostics = $derived.by<LayoutToolDiagnostic[]>(() =>
		warning
			? [{ id: 'layout-font-warning', tone: 'warning', message: warning }]
			: []
	);

	function injectFontCss(css: string): void {
		if (typeof document === 'undefined') {
			return;
		}
		if (!styleElement) {
			styleElement = document.createElement('style');
			styleElement.dataset.layoutToolFont = 'true';
			document.head.append(styleElement);
		}
		styleElement.textContent = css;
	}

	async function waitForFonts(): Promise<void> {
		if (typeof document !== 'undefined' && 'fonts' in document) {
			await document.fonts.ready;
		}
	}

	async function loadGoogleFontWithWeights(
		nextFamily: string,
		weightsOverride?: readonly number[]
	): Promise<void> {
		const normalizedFamily = nextFamily.trim();
		if (!normalizedFamily) {
			warning = 'Font family must not be empty.';
			family = fallback;
			return;
		}

		loading = true;
		warning = '';
		try {
			const weights = (
				weightsOverride?.length
					? weightsOverride
					: options.googleWeights?.length
						? options.googleWeights
						: [400, 700]
			).join(';');
			const familyQuery = normalizedFamily.trim().replace(/\s+/g, '+');
			const cssUrl = `https://fonts.googleapis.com/css2?family=${familyQuery}:wght@${weights}&display=swap`;
			const cssResponse = await fetch(cssUrl);
			if (!cssResponse.ok) {
				throw new Error(`Google Fonts returned ${cssResponse.status}.`);
			}

			let css = await cssResponse.text();
			const urlPattern = /url\(([^)]+)\)/g;
			const replacements: Array<[string, string]> = [];
			for (const match of css.matchAll(urlPattern)) {
				const rawUrl = match[1]?.trim().replace(/^['"]|['"]$/g, '');
				if (!rawUrl || rawUrl.startsWith('data:')) continue;
				const fontResponse = await fetch(rawUrl);
				if (!fontResponse.ok) {
					throw new Error(`Google Fonts file returned ${fontResponse.status}.`);
				}
				replacements.push([match[0], `url(${await responseToDataUrl(fontResponse)})`]);
			}
			for (const [from, to] of replacements) {
				css = css.replace(from, to);
			}

			fontFaceCss = css;
			injectFontCss(css);
			family = `'${cssString(normalizedFamily)}', ${fallback}`;
			await waitForFonts();
		} catch (error) {
			warning = `Failed to load Google Font "${normalizedFamily}". Falling back to system fonts.`;
			fontFaceCss = '';
			family = fallback;
			injectFontCss('');
			console.warn(error);
		} finally {
			loading = false;
		}
	}

	async function loadGoogleFont(nextFamily: string): Promise<void> {
		await loadGoogleFontWithWeights(nextFamily);
	}

	async function loadGoogleFontFromUrl(input: string): Promise<ParsedGoogleFontUrl | null> {
		const parsed = parseGoogleFontUrlInput(input);
		if (!parsed) {
			warning = 'Could not parse a Google Fonts family from the provided URL.';
			return null;
		}

		await loadGoogleFontWithWeights(parsed.family, parsed.weights);
		return parsed;
	}

	async function useUploadedFont(slotId: string, nextFamily?: string): Promise<void> {
		const item = sources.getSlot(slotId)?.currentItem;
		if (!item || item.kind !== 'font') {
			warning = `No uploaded font is available in source slot "${slotId}".`;
			family = fallback;
			return;
		}

		const fontItem = item as ImportedFontFileItem;
		const resolvedFamily = nextFamily?.trim() || fontItem.name.replace(/\.[^.]+$/, '') || 'Uploaded Font';
		const css = `@font-face { font-family: '${cssString(resolvedFamily)}'; src: url('${fontItem.dataUrl}'); font-display: swap; }`;
		warning = '';
		fontFaceCss = css;
		injectFontCss(css);
		family = `'${cssString(resolvedFamily)}', ${fallback}`;
		await waitForFonts();
	}

	function reset(): void {
		warning = '';
		fontFaceCss = '';
		family = options.defaultFamily ?? fallback;
		injectFontCss('');
	}

	onDestroy(() => {
		styleElement?.remove();
		styleElement = null;
	});

	return {
		get family() {
			return family;
		},
		get fontFaceCss() {
			return fontFaceCss;
		},
		get loading() {
			return loading;
		},
		get warning() {
			return warning;
		},
		get diagnostics() {
			return diagnostics;
		},
		getGoogleFontsBrowseUrl: (input = '') => createGoogleFontsBrowseUrl(input || family),
		loadGoogleFont,
		loadGoogleFontFromUrl,
		useUploadedFont,
		reset
	};
}

export function createLayoutToolController(options: LayoutToolControllerOptions): LayoutToolController {
	const size = createSizeController(options.size);
	const sources = createToolSourceSlotCollection(options.sources);
	const fonts = createFontController(options.fonts, sources);
	const exportContext = getCanvasExportContext();
	let disposed = false;

	const descriptor = {
		kind: 'dom' as const,
		get contentWidth() {
			return size.contentWidth;
		},
		get contentHeight() {
			return size.contentHeight;
		},
		getElement: options.export.getElement,
		get domOptions() {
			return {
				...options.export.domOptions,
				fontEmbedCSS: fonts.fontFaceCss || options.export.domOptions?.fontEmbedCSS
			};
		},
		getWarnings: () => fonts.diagnostics.map((diagnostic) => diagnostic.message),
		capabilities: { png: true }
	};
	const unregister = exportContext?.register(descriptor, {
		id: options.export.id ?? 'layout-dom',
		label: options.export.label ?? 'Layout DOM'
	}) ?? (() => {});

	const diagnostics = $derived.by<LayoutToolDiagnostic[]>(() => {
		const next = [...size.diagnostics, ...fonts.diagnostics];
		for (const slot of sources.slots) {
			if (slot.required && !slot.currentItem) {
				next.push({
					id: `missing-source-${slot.id}`,
					tone: 'warning',
					message: `${slot.name} is required.`
				});
			}
		}
		if (!options.export.getElement()) {
			next.push({
				id: 'missing-export-root',
				tone: 'info',
				message: 'Layout export root is not available yet.'
			});
		}
		return next;
	});

	function dispose(): void {
		if (disposed) return;
		disposed = true;
		unregister();
		sources.dispose();
		fonts.reset();
	}

	onDestroy(dispose);

	return {
		size,
		sources,
		fonts,
		get diagnostics() {
			return diagnostics;
		},
		dispose
	};
}
