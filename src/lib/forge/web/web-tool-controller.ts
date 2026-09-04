/**
 * Web Tool Container controller: owns the DOM side of a Tool Session for Deshelf Web.
 * Creates the same-origin Main iframe (and the optional Slate iframe once the Main
 * Canvas is Ready), adopts their transports into a `ToolSession`, forwards Surface
 * resizes, and exposes Restart/Close plus browser Asset Input / Visual Output adapters.
 *
 * Same-origin note: the Tool Container runs in the SAME renderer process as the Host.
 * A looping tool can freeze the whole page — the product accepts this and does NOT
 * promise process- or failure isolation. Restart lives in the Host chrome
 * (`restart()` wired to the Failed/Unresponsive banner in the UI).
 */
import { error, type AssetContent, type CatalogEntry, type Diagnostic } from 'tool-contract';
import {
	ToolSession,
	type DeshelfRuntimeConfig,
	type ReloadHandle,
	type ToolSessionHealth,
	type ToolSessionState
} from 'tool-host';
import { createIframeHostTransport, type IframeHostTransport } from '../iframe/host-transport.js';

export interface WebToolControllerOptions {
	entry: CatalogEntry;
	/** Container chrome page and the pre-compiled Main artifact URL. */
	containerPageUrl: string;
	mainArtifactUrl: string;
	/** Element that hosts the canvas iframe (its box drives the Surface size). */
	canvasHost: HTMLElement;
	/** Required when `entry.surfaces.slate` is true. */
	slateHost?: HTMLElement;
	runtimeConfig?: Partial<DeshelfRuntimeConfig>;
	/** Environment-supplied asset adapter; defaults to "no contents" (empty answers). */
	assetResolver?: (assetId: string) => AssetContent | null | Promise<AssetContent | null>;
	/** Deterministic tests pin the session id. */
	sessionId?: string;
	/** Injectable browser URL cleanup for deterministic resource-lifecycle tests. */
	revokeObjectUrl?: (url: string) => void;
	onStateChange?: (state: ToolSessionState) => void;
	onHealthChange?: (health: ToolSessionHealth) => void;
	onSessionIdChange?: (sessionId: string) => void;
	onDiagnostic?: (diagnostic: Diagnostic) => void;
	/** Injectable element factory/observer for deterministic tests. */
	documentRef?: Document;
	/** Installs resize observation; returns a detach function. */
	createResizeObserver?: (
		target: Element,
		onResize: (size: { width: number; height: number }) => void
	) => () => void;
}

export interface WebToolExportResult {
	ok: boolean;
	error?: Diagnostic;
	content?: AssetContent;
}

export interface WebToolReloadRequest {
	/** The staged replacement Catalog Entry (e.g. re-resolved from a refreshed catalog). */
	entry: CatalogEntry;
	/** Pre-compiled Main artifact URL of the replacement entry. */
	mainArtifactUrl: string;
}

export interface WebToolReloadResult {
	ok: boolean;
	diagnostic?: Diagnostic;
}

interface SurfaceSize {
	width: number;
	height: number;
}

const FALLBACK_SURFACE: SurfaceSize = { width: 640, height: 360 };

export class WebToolController {
	readonly session: ToolSession;

	private entry: CatalogEntry;
	private readonly canvasHost: HTMLElement;
	private readonly slateHost?: HTMLElement;
	private readonly containerPageUrl: string;
	private readonly documentRef: Document;
	private readonly createResizeObserver: NonNullable<WebToolControllerOptions['createResizeObserver']>;
	private readonly onStateChange?: (state: ToolSessionState) => void;
	private readonly onSessionIdChange?: (sessionId: string) => void;
	private readonly revokeObjectUrl: (url: string) => void;
	private readonly ownedAssetUrls = new Map<string, string>();
	private readonly detachResize: Array<() => void> = [];
	private mainIframe: HTMLIFrameElement | undefined;
	private mainTransport: IframeHostTransport | undefined;
	private slateIframe: HTMLIFrameElement | undefined;
	private slateTransport: IframeHostTransport | undefined;
	/** Active staged Reload: replacement containers awaiting the atomic commit. */
	private pendingReload: {
		handle: ReloadHandle;
		mainIframe: HTMLIFrameElement;
		mainTransport: IframeHostTransport;
		slateIframe?: HTMLIFrameElement;
		slateTransport?: IframeHostTransport;
	} | undefined;
	private slateBooted = false;
	private closed = false;

	constructor(options: WebToolControllerOptions) {
		this.entry = options.entry;
		this.canvasHost = options.canvasHost;
		this.slateHost = options.slateHost;
		this.containerPageUrl = options.containerPageUrl;
		this.mainArtifactUrl = options.mainArtifactUrl;
		this.documentRef = options.documentRef ?? document;
		this.createResizeObserver =
			options.createResizeObserver ??
			((target, onResize) => {
				const observer = new ResizeObserver((entries) => {
					const rect = entries[0]?.contentRect;
					if (rect !== undefined) onResize({ width: Math.round(rect.width), height: Math.round(rect.height) });
				});
				observer.observe(target);
				return () => observer.disconnect();
			});
		this.onStateChange = options.onStateChange;
		this.onSessionIdChange = options.onSessionIdChange;
		this.revokeObjectUrl = options.revokeObjectUrl ?? ((url) => URL.revokeObjectURL(url));
		this.session = new ToolSession({
			entry: options.entry,
			runtimeConfig: options.runtimeConfig,
			assetResolver: options.assetResolver,
			sessionId: options.sessionId,
			onStateChange: (state) => {
				// The Slate Container boots only after the Main Canvas is Ready — never
				// before, and its readiness never blocks the first Canvas frame.
				if (state === 'Ready') this.bootSlateIfPlanned();
				this.onStateChange?.(state);
			},
			onHealthChange: options.onHealthChange,
			onSessionIdChange: (sessionId) => this.onSessionIdChange?.(sessionId),
			onReloadSettled: (outcome) => this.handleReloadSettled(outcome),
			onDiagnostic: options.onDiagnostic
		});
	}

	/** Creates the Main Container and boots the Session. */
	open(): void {
		if (this.closed) throw new Error('web-tool-controller: controller is closed');
		if (this.mainIframe !== undefined) throw new Error('web-tool-controller: container already open');
		const surface = this.measure(this.canvasHost);
		this.mainIframe = this.createContainerIframe('main');
		this.canvasHost.appendChild(this.mainIframe);
		this.mainTransport = this.adoptTransport(this.mainIframe);
		this.observeSurface(this.canvasHost, 'main');
		this.session.boot({
			main: this.mainTransport,
			surface: { kind: 'canvas', ...surface },
			// Environment Inventory: what this Web environment actually supplies.
			inventory: {
				assets: Object.keys(this.entry.assets),
				exports: Object.keys(this.entry.outputs)
			}
		});
	}

	/** Restart Tool: fresh Session ID + fresh Containers over the current artifact. */
	restart(): void {
		if (this.closed) throw new Error('web-tool-controller: controller is closed');
		const surface = this.measure(this.canvasHost);
		// The replacement container is adopted first so `session.restart` can deliver its
		// best-effort `surface.dispose` over the still-open old transports.
		const nextIframe = this.createContainerIframe('main');
		this.canvasHost.appendChild(nextIframe);
		const nextTransport = this.adoptTransport(nextIframe);
		this.session.restart({
			main: nextTransport,
			surface: { kind: 'canvas', ...surface },
			inventory: {
				assets: Object.keys(this.entry.assets),
				exports: Object.keys(this.entry.outputs)
			}
		});
		this.discardContainers();
		this.mainIframe = nextIframe;
		this.mainTransport = nextTransport;
		this.slateBooted = false;
		this.observeSurface(this.canvasHost, 'main');
	}

	/**
	 * Staged Reload: boots the replacement Containers with the NEW Catalog Entry while
	 * the old Session stays active. The swap happens only when the replacement Canvas
	 * reports ready (atomic commit); any failure releases staged resources and keeps the
	 * old Session — the pre-cutover DOM containers are discarded instead.
	 */
	reload(request: WebToolReloadRequest): WebToolReloadResult {
		if (this.closed) throw new Error('web-tool-controller: controller is closed');
		if (this.pendingReload !== undefined) {
			return { ok: false, diagnostic: error('web/reload-in-progress', 'a replacement is already staged') };
		}
		const result = this.session.reloadStart(request.entry);
		if (!result.ok) return { ok: false, diagnostic: result.diagnostic };
		const handle: ReloadHandle = result.handle;

		// Replacement Main container (adopted first, booted by adoptMain).
		const mainSurface = this.measure(this.canvasHost);
		const mainIframe = this.createContainerIframe('main', request.mainArtifactUrl);
		this.canvasHost.appendChild(mainIframe);
		const mainTransport = this.adoptTransport(mainIframe);

		// Replacement Slate plan: the replacement Slate must boot after the promoted Main
		// is Ready, so its boot envelope is deferred to commit (recorded as a plan here).
		let slateIframe: HTMLIFrameElement | undefined;
		let slateTransport: IframeHostTransport | undefined;
		if (this.slateHost !== undefined && request.entry.surfaces.slate) {
			const slateSurface = this.measure(this.slateHost);
			slateIframe = this.createContainerIframe('slate', request.mainArtifactUrl);
			this.slateHost.appendChild(slateIframe);
			slateTransport = this.adoptTransport(slateIframe);
			handle.adoptSlate({ transport: slateTransport, surface: { kind: 'slate', ...slateSurface } });
		}

		this.pendingReload = { handle, mainIframe, mainTransport, slateIframe, slateTransport };
		handle.adoptMain({
			main: mainTransport,
			surface: { kind: 'canvas', ...mainSurface },
			inventory: {
				assets: Object.keys(request.entry.assets),
				exports: Object.keys(request.entry.outputs)
			}
		});
		return { ok: true };
	}

	/** Closes the Session and removes both containers. */
	close(): void {
		if (this.closed) return;
		this.closed = true;
		// `session.close()` sends surface.dispose over the live transports first; the DOM
		// teardown happens right after, so the message still reaches the containers.
		this.session.close();
		this.discardContainers();
		this.releaseAssetUrls();
	}

	/** Browser asset input: object URL of the picked file, delivered through the Store. */
	setAssetFromFile(assetId: string, file: File): AssetContent {
		const previousUrl = this.ownedAssetUrls.get(assetId);
		if (previousUrl !== undefined) this.revokeObjectUrl(previousUrl);
		const content: AssetContent = {
			kind: 'blob-url',
			mime: file.type !== '' ? file.type : 'application/octet-stream',
			url: URL.createObjectURL(file)
		};
		this.ownedAssetUrls.set(assetId, content.url);
		this.session.setAsset(assetId, content);
		return content;
	}

	/** Visual Output export through the Main artifact; resolves with serializable content. */
	async exportOutput(outputId: string): Promise<WebToolExportResult> {
		try {
			const result = await this.session.executeExport(outputId);
			return { ok: result.ok, error: result.error, content: result.content };
		} catch (err) {
			return {
				ok: false,
				error: { severity: 'error', code: 'export/failed', message: err instanceof Error ? err.message : String(err) }
			};
		}
	}

	// ------------------------------------------------------------------ internals

	/**
	 * Settles the staged Reload DOM: commit promotes the replacement containers (the
	 * Session already promoted the transports); failure/cancel discards them while the
	 * old Session stays active with its original containers.
	 */
	private handleReloadSettled(outcome: { ok: boolean; reason?: string }): void {
		const pending = this.pendingReload;
		if (pending === undefined) return;
		this.pendingReload = undefined;
		if (outcome.ok) {
			// The Session promoted the replacement transports; adopt the DOM side.
			this.entry = pending.handle.newEntry;
			this.mainTransport?.close();
			this.mainIframe?.remove();
			this.slateTransport?.close();
			this.slateIframe?.remove();
			this.mainIframe = pending.mainIframe;
			this.mainTransport = pending.mainTransport;
			this.slateIframe = pending.slateIframe;
			this.slateTransport = pending.slateTransport;
			// The replacement Slate (if planned) was booted by the commit itself.
			this.slateBooted = pending.slateIframe !== undefined;
		} else {
			pending.mainTransport.close();
			pending.mainIframe.remove();
			pending.slateTransport?.close();
			pending.slateIframe?.remove();
		}
	}

	private bootSlateIfPlanned(): void {
		if (this.closed || this.slateBooted) return;
		if (this.slateHost === undefined || !this.entry.surfaces.slate) return;
		if (this.session.getState() !== 'Ready') return;
		this.slateBooted = true;
		const surface = this.measure(this.slateHost);
		this.slateIframe = this.createContainerIframe('slate');
		this.slateHost.appendChild(this.slateIframe);
		this.slateTransport = this.adoptTransport(this.slateIframe);
		this.observeSurface(this.slateHost, 'slate');
		this.session.bootSlate({ transport: this.slateTransport, surface: { kind: 'slate', ...surface } });
	}

	private adoptTransport(iframe: HTMLIFrameElement): IframeHostTransport {
		return createIframeHostTransport({
			iframe,
			listen: (this.documentRef.defaultView ?? window) as unknown as Parameters<typeof createIframeHostTransport>[0]['listen'],
			origin: this.origin()
		});
	}

	private observeSurface(element: HTMLElement, role: 'main' | 'slate'): void {
		this.detachResize.push(
			this.createResizeObserver(element, (size) => {
				this.session.resizeSurface(role, size);
			})
		);
	}

	private createContainerIframe(endpoint: 'main' | 'slate', artifactUrl?: string): HTMLIFrameElement {
		const iframe = this.documentRef.createElement('iframe');
		iframe.setAttribute('title', `${this.entry.name} — ${endpoint}`);
		iframe.setAttribute('data-deshelf-endpoint', endpoint);
		iframe.setAttribute('referrerpolicy', 'no-referrer');
		// Deliberately NO `sandbox` attribute: a sandbox would produce a unique opaque
		// origin and break same-origin artifact/library supply. There is no Capability
		// Grant either — the Environment API carries the management plane only.
		iframe.style.width = '100%';
		iframe.style.height = '100%';
		iframe.style.border = '0';
		iframe.style.display = 'block';
		iframe.style.background = 'transparent';
		// `src` is set BEFORE insertion: exactly one load event (no about:blank cycle),
		// so the transport's queued boot flushes precisely when the document is ready.
		const entryArtifact = artifactUrl ?? this.mainArtifactUrl;
		iframe.src = `${this.containerPageUrl}?entry=${encodeURIComponent(entryArtifact)}&endpoint=${endpoint}`;
		return iframe;
	}

	private measure(element: HTMLElement): SurfaceSize {
		const rect = element.getBoundingClientRect();
		const width = Math.round(rect.width);
		const height = Math.round(rect.height);
		return {
			width: width > 0 ? width : FALLBACK_SURFACE.width,
			height: height > 0 ? height : FALLBACK_SURFACE.height
		};
	}

	private origin(): string {
		return this.documentRef.defaultView?.location.origin ?? window.location.origin;
	}

	private releaseAssetUrls(): void {
		for (const url of this.ownedAssetUrls.values()) this.revokeObjectUrl(url);
		this.ownedAssetUrls.clear();
	}

	private discardContainers(): void {
		for (const detach of this.detachResize) detach();
		this.detachResize.length = 0;
		this.mainTransport?.close();
		this.slateTransport?.close();
		this.mainTransport = undefined;
		this.slateTransport = undefined;
		this.mainIframe?.remove();
		this.slateIframe?.remove();
		this.mainIframe = undefined;
		this.slateIframe = undefined;
	}
}
