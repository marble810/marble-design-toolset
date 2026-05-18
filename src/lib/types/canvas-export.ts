export type CanvasExporterKind = 'canvas' | 'render' | 'dom';

export type PngBitDepth = 8 | 16;

export interface CapabilityFlags {
	/** Whether PNG export is supported. Default true. */
	png?: boolean;
	/** Whether MP4 export is supported. Default true (forced false for kind=dom). */
	mp4?: boolean;
	/** Maximum PNG bit depth. Default 8. Only meaningful for kind=canvas/render. */
	pngBitDepth?: PngBitDepth;
}

export interface ResolvedCapabilities {
	png: boolean;
	mp4: boolean;
	pngBitDepth: PngBitDepth;
}

export interface CanvasExportDiagnostic {
	id: string;
	tone: 'info' | 'warning';
	message: string;
}

export interface CanvasExporterDomOptions {
	backgroundColor?: string;
	filter?: (node: HTMLElement) => boolean;
	cacheBust?: boolean;
	style?: Partial<CSSStyleDeclaration>;
	fontEmbedCSS?: string;
}

export interface RenderFrameContext {
	canvas: HTMLCanvasElement;
	time: number;
	frameIndex: number;
}

export interface RenderFrame16Context {
	time: number;
	frameIndex: number;
}

export interface Pixels16Buffer {
	data: Uint16Array;
	width: number;
	height: number;
	channels: 3 | 4;
}

/**
 * Common fields every exporter descriptor must provide so the framework
 * Export panel (rendered inside LeftPanel) can size output independently of
 * any preview surface (PreviewCanvas / FullStage / etc.).
 *
 * `contentWidth` / `contentHeight` represent the logical pixel size of the
 * source frame at scale=1. Implementations may use getter properties so the
 * values stay reactive when the tool resizes its render target.
 */
export interface CanvasExporterContentSize {
	readonly contentWidth: number;
	readonly contentHeight: number;
}

export interface CanvasExporterCanvas extends CanvasExporterContentSize {
	kind: 'canvas';
	getCanvas: () => HTMLCanvasElement | null;
	getPixels16?: () => Pixels16Buffer | null;
	capabilities?: CapabilityFlags;
}

export interface CanvasExporterRender extends CanvasExporterContentSize {
	kind: 'render';
	renderFrame: (ctx: RenderFrameContext) => void | Promise<void>;
	renderFrame16?: (ctx: RenderFrame16Context) => Promise<Pixels16Buffer> | Pixels16Buffer;
	capabilities?: CapabilityFlags;
}

export interface CanvasExporterDom extends CanvasExporterContentSize {
	kind: 'dom';
	getElement: () => HTMLElement | null;
	domOptions?: CanvasExporterDomOptions;
	getWarnings?: () => readonly string[];
	capabilities?: Omit<CapabilityFlags, 'mp4' | 'pngBitDepth'>;
}

export type CanvasExporterDescriptor =
	| CanvasExporterCanvas
	| CanvasExporterRender
	| CanvasExporterDom;

export interface RegisteredExporter {
	id: string;
	label: string;
	descriptor: CanvasExporterDescriptor;
	resolved: ResolvedCapabilities;
}

export interface CanvasExporterRegistrationOptions {
	id?: string;
	label?: string;
}

export interface PngExportOptions {
	scale: 1 | 2 | 4;
	bitDepth: PngBitDepth;
	filename: string;
}

export interface Mp4ExportOptions {
	scale: 1 | 2 | 4;
	fps: 24 | 30 | 60;
	durationSeconds: number;
	filename: string;
}

export interface ExportResult {
	ok: boolean;
	filename?: string;
	mime?: string;
	extension?: string;
	bitDepth?: PngBitDepth;
	warnings?: string[];
	error?: string;
	notice?: string;
}

export interface CanvasExportContextValue {
	exporters: ReadonlyArray<RegisteredExporter>;
	register: (
		descriptor: CanvasExporterDescriptor,
		options?: CanvasExporterRegistrationOptions
	) => () => void;
}
