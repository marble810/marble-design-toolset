/**
 * Desktop Tool Container controller: owns the Host UI renderer side of a Tool Session
 * for Deshelf Desktop. Requests realm creation in Main, adopts the transferred
 * MessagePort transports into a `ToolSession`, forwards Surface resizes, and exposes
 * Restart/Close plus the Desktop Asset Input / Visual Output adapters.
 *
 * Transport shape: Main performs the ONE-TIME MessageChannel handoff — the Host
 * renderer receives its end via the fixed `portHandoff` channel; all Environment
 * traffic then flows renderer↔renderer over the port. No per-message IPC forwarding.
 *
 * Isolation: unlike the Web same-origin iframe, the container runs in its own
 * renderer process with sandbox/contextIsolation. A looping tool wedges only the
 * container WebContents; Restart asks Main to destroy the realm and open a new one.
 */
import type { AssetContent, CatalogEntry, Diagnostic } from 'tool-contract';
import {
	ToolSession,
	type DeshelfRuntimeConfig,
	type ToolSessionHealth,
	type ToolSessionState
} from 'tool-host';
import type {
	AssetPickRequest,
	AssetPickResult,
	AssetUrlRequest,
	AssetUrlResult,
	ExportSaveRequest,
	ExportSaveResult,
	OpenToolSessionRequest,
	OpenToolSessionResult,
	PortHandoffPayload,
	ToolSurfaceBounds
} from '../shared/bridge-protocol.ts';
import { createPortTransport, type PortLike } from '../transport/port-transport.ts';

/** Structural view of the preload-exposed Desktop bridge (Host UI renderer side). */
export interface DesktopHostBridge {
	openToolSession(request: OpenToolSessionRequest): Promise<OpenToolSessionResult>;
	closeToolSession(request: { sessionId: string; endpoint?: 'main' | 'slate' }): Promise<{ ok: boolean }>;
	setToolSurfaceBounds(request: { sessionId: string; endpoint: 'main' | 'slate'; bounds: ToolSurfaceBounds }): Promise<{ ok: boolean }>;
	/** Registers the one-time port handoff listener; returns an unsubscribe. */
	onPortHandoff(handler: (payload: PortHandoffPayload, port: PortLike) => void): () => void;
	pickAsset(request: AssetPickRequest): Promise<AssetPickResult>;
	assetUrl(request: AssetUrlRequest): Promise<AssetUrlResult>;
	exportSave(request: ExportSaveRequest): Promise<ExportSaveResult>;
}

export interface DesktopToolControllerOptions {
	entry: CatalogEntry;
	bridge: DesktopHostBridge;
	/** Element that hosts the canvas WebContents view (its box drives the Surface size). */
	canvasHost: HTMLElement;
	/** Required when `entry.surfaces.slate` is true. */
	slateHost?: HTMLElement;
	runtimeConfig?: Partial<DeshelfRuntimeConfig>;
	onStateChange?: (state: ToolSessionState) => void;
	onHealthChange?: (health: ToolSessionHealth) => void;
	onDiagnostic?: (diagnostic: Diagnostic) => void;
	/** Injectable element factory/observer for deterministic tests. */
	documentRef?: Document;
	createResizeObserver?: (
		target: Element,
		onResize: (size: { width: number; height: number }) => void
	) => () => void;
}

export interface DesktopToolExportResult {
	ok: boolean;
	error?: Diagnostic;
	saved?: { ok: boolean; canceled?: boolean; error?: string };
}

const FALLBACK_SURFACE = { width: 640, height: 360 };

export class DesktopToolController {
	readonly session: ToolSession;

	private readonly entry: CatalogEntry;
	private readonly bridge: DesktopHostBridge;
	private readonly canvasHost: HTMLElement;
	private readonly slateHost?: HTMLElement;
	private readonly documentRef: Document;
	private readonly createResizeObserver: NonNullable<DesktopToolControllerOptions['createResizeObserver']>;
	private readonly detachResize: Array<() => void> = [];
	private readonly onStateChange?: (state: ToolSessionState) => void;
	private readonly onDiagnostic?: (diagnostic: Diagnostic) => void;
	private readonly pendingPorts = new Map<string, { endpoint: 'main' | 'slate'; port: PortLike }>();
	private readonly unsubscribeHandoff: () => void;
	private sessionId: string | undefined;
	private inventory: OpenToolSessionResult['inventory'] = { assets: [], exports: [] };
	private slateBooted = false;
	private closed = false;

	constructor(options: DesktopToolControllerOptions) {
		this.entry = options.entry;
		this.bridge = options.bridge;
		this.canvasHost = options.canvasHost;
		this.slateHost = options.slateHost;
		this.documentRef = options.documentRef ?? document;
		this.onStateChange = options.onStateChange;
		this.onDiagnostic = options.onDiagnostic;
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
		this.unsubscribeHandoff = this.bridge.onPortHandoff((payload, port) => {
			this.pendingPorts.set(payload.sessionId, { endpoint: payload.endpoint, port });
		});
		this.session = new ToolSession({
			entry: options.entry,
			runtimeConfig: options.runtimeConfig,
			sessionId: undefined,
			onStateChange: (state) => {
				// The Slate realm boots only after the Main Canvas is Ready — never before,
				// and its readiness never blocks the first Canvas frame.
				if (state === 'Ready') void this.bootSlateIfPlanned();
				this.onStateChange?.(state);
			},
			onHealthChange: options.onHealthChange,
			onDiagnostic: options.onDiagnostic
		});
	}

	/** Opens the Main realm in Main and boots the Session. Failure releases the realm. */
	async open(): Promise<void> {
		if (this.closed) throw new Error('desktop-tool-controller: controller is closed');
		if (this.sessionId !== undefined) throw new Error('desktop-tool-controller: session already open');
		const opened = await this.bridge.openToolSession({
			catalogEntryId: this.entry.catalogEntryId,
			endpoint: 'main',
			bounds: this.measure(this.canvasHost)
		});
		try {
			await this.adoptSession(opened, { mode: 'boot' });
		} catch (err) {
			// Failed adoption must not leak the already-created Main realm in Main.
			await this.bridge.closeToolSession({ sessionId: opened.sessionId }).catch(() => {});
			throw err;
		}
	}

	/**
	 * Restart Tool: fresh session id + fresh realms in Main over the current artifact.
	 * The old realms are destroyed in Main only after the replacement was adopted, so
	 * `surface.dispose` can still be delivered over the old transports.
	 */
	async restart(): Promise<void> {
		if (this.closed) throw new Error('desktop-tool-controller: controller is closed');
		if (this.sessionId === undefined) throw new Error('desktop-tool-controller: session not open');
		const previousSessionId = this.sessionId;
		const opened = await this.bridge.openToolSession({
			catalogEntryId: this.entry.catalogEntryId,
			endpoint: 'main',
			bounds: this.measure(this.canvasHost)
		});
		try {
			await this.adoptSession(opened, { mode: 'restart' });
		} catch (err) {
			// Failed adoption must not leak the replacement realm.
			await this.bridge.closeToolSession({ sessionId: opened.sessionId }).catch(() => {});
			throw err;
		}
		this.slateBooted = false;
		// Desktop asset URLs are owned by the old Main-process session. Clear the fresh
		// Session snapshot before releasing those bytes so no stale opaque URL survives.
		for (const assetId of Object.keys(this.entry.assets)) {
			this.session.setAsset(assetId, { kind: 'empty' });
		}
		// Destroy the old realms in Main; the session already sent surface.dispose.
		await this.bridge.closeToolSession({ sessionId: previousSessionId });
	}

	/** Closes the Session and destroys the realms in Main. */
	async close(): Promise<void> {
		if (this.closed) return;
		this.closed = true;
		this.session.close();
		this.unsubscribeHandoff();
		for (const detach of this.detachResize) detach();
		this.detachResize.length = 0;
		if (this.sessionId !== undefined) {
			await this.bridge.closeToolSession({ sessionId: this.sessionId });
			this.sessionId = undefined;
		}
	}

	/**
	 * Desktop asset input: file dialog in Main (bytes stay there), container gets an
	 * opaque `deshelf-cache://session-assets/<handle>` URL through the Store.
	 */
	async setAssetFromPicker(assetId: string, options?: { title?: string }): Promise<AssetPickResult> {
		const sessionId = this.sessionId;
		if (sessionId === undefined) return { ok: false };
		const picked = await this.bridge.pickAsset({ sessionId, title: options?.title ?? `Select asset for '${assetId}'` });
		if (!picked.ok || picked.handle === undefined) return picked;
		const resolved = await this.bridge.assetUrl({ sessionId, handle: picked.handle });
		const content: AssetContent = { kind: 'blob-url', mime: resolved.mime, url: resolved.url };
		this.session.setAsset(assetId, content);
		return picked;
	}

	/** Visual Output export: render in container, save dialog + disk write in Main. */
	async exportOutput(outputId: string): Promise<DesktopToolExportResult> {
		const sessionId = this.sessionId;
		if (sessionId === undefined) {
			return { ok: false, error: { severity: 'error', code: 'export/no-session', message: 'session is not open' } };
		}
		try {
			const result = await this.session.executeExport(outputId);
			if (!result.ok) return { ok: false, error: result.error };
			const output = this.entry.outputs[outputId];
			const saved = await this.bridge.exportSave({
				sessionId,
				outputId,
				suggestedName: `${this.entry.slug}-${outputId}`,
				mime: output?.mime ?? 'application/octet-stream',
				content: (result.content ?? { kind: 'empty' }) as { kind: string; url?: string; data?: string }
			});
			return { ok: saved.ok, saved, error: saved.error !== undefined ? { severity: 'error', code: 'export/save-failed', message: saved.error } : undefined };
		} catch (err) {
			return {
				ok: false,
				error: { severity: 'error', code: 'export/failed', message: err instanceof Error ? err.message : String(err) }
			};
		}
	}

	/** Opaque handles stored per asset id for `asset.request` answers. */
	setAssetContent(assetId: string, content: AssetContent): void {
		this.session.setAsset(assetId, content);
	}

	// ------------------------------------------------------------------ internals

	private async adoptSession(opened: OpenToolSessionResult, mode: { mode: 'boot' } | { mode: 'restart' }): Promise<void> {
		const surface = this.measure(this.canvasHost);
		const port = await this.waitForPort(opened.sessionId, 'main');
		this.sessionId = opened.sessionId;
		this.inventory = opened.inventory;
		this.observeSurface(this.canvasHost, 'main');
		const bootOptions = {
			main: createPortTransport(port),
			surface: { kind: 'canvas' as const, ...surface },
			inventory: this.inventory,
			// Pin the Main-issued realm id so session filtering and realm tracking agree.
			sessionId: opened.sessionId
		};
		if (mode.mode === 'boot') {
			this.session.boot(bootOptions);
		} else {
			this.session.restart(bootOptions);
		}
	}

	private waitForPort(sessionId: string, endpoint: 'main' | 'slate'): Promise<PortLike> {
		const pending = this.pendingPorts.get(sessionId);
		if (pending !== undefined && pending.endpoint === endpoint) {
			this.pendingPorts.delete(sessionId);
			return Promise.resolve(pending.port);
		}
		return new Promise((resolve, reject) => {
			const started = Date.now();
			const poll = (): void => {
				const found = this.pendingPorts.get(sessionId);
				if (found !== undefined && found.endpoint === endpoint) {
					this.pendingPorts.delete(sessionId);
					resolve(found.port);
					return;
				}
				if (Date.now() - started > 10_000) {
					reject(new Error(`timed out waiting for ${endpoint} port handoff (session ${sessionId})`));
					return;
				}
				setTimeout(poll, 10);
			};
			poll();
		});
	}

	private async bootSlateIfPlanned(): Promise<void> {
		if (this.closed || this.slateBooted) return;
		if (this.slateHost === undefined || !this.entry.surfaces.slate) return;
		if (this.sessionId === undefined) return;
		try {
			this.slateBooted = true;
			const opened = await this.bridge.openToolSession({
				catalogEntryId: this.entry.catalogEntryId,
				sessionId: this.sessionId,
				endpoint: 'slate',
				bounds: this.measure(this.slateHost)
			});
			try {
				const port = await this.waitForPort(opened.sessionId, 'slate');
				const surface = this.measure(this.slateHost);
				this.observeSurface(this.slateHost, 'slate');
				this.session.bootSlate({ transport: createPortTransport(port), surface: { kind: 'slate', ...surface } });
			} catch (err) {
				// A failed Slate boot must not tear down the healthy Main Canvas realm.
				await this.bridge.closeToolSession({ sessionId: opened.sessionId, endpoint: 'slate' }).catch(() => {});
				this.slateBooted = false;
				throw err;
			}
		} catch (err) {
			// Slate failures never block the Canvas Ready path (architecture §6).
			this.onDiagnostic?.({ severity: 'warning', code: 'slate/boot-deferred', message: err instanceof Error ? err.message : String(err) });
		}
	}

	private observeSurface(element: HTMLElement, role: 'main' | 'slate'): void {
		this.detachResize.push(
			this.createResizeObserver(element, (size) => {
				this.session.resizeSurface(role, size);
				if (this.sessionId !== undefined) {
					void this.bridge.setToolSurfaceBounds({
						sessionId: this.sessionId,
						endpoint: role,
						bounds: this.measure(element)
					});
				}
			})
		);
	}

	private measure(element: HTMLElement): ToolSurfaceBounds {
		const rect = element.getBoundingClientRect();
		const width = Math.round(rect.width);
		const height = Math.round(rect.height);
		return {
			x: Math.max(0, Math.round(rect.left)),
			y: Math.max(0, Math.round(rect.top)),
			width: width > 0 ? width : FALLBACK_SURFACE.width,
			height: height > 0 ? height : FALLBACK_SURFACE.height
		};
	}
}
