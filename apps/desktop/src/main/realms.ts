/**
 * Tool Container realm lifecycle (Main process, WebContents + MessagePort).
 *
 * One realm = one container WebContents (Main Canvas or Tool Slate) plus one end of a
 * dedicated MessageChannel. The Main process creates the channel and performs the
 * ONE-TIME handoff: `port1` is transferred into the container WebContents, `port2` is
 * returned for transfer into the Host UI renderer. After the handoff the Main process
 * never forwards Environment traffic — renderer↔renderer MessagePort only.
 *
 * Lifecycle guarantees (Restart/Reload/Close):
 * - every WebContents is tracked per session and destroyed exactly once;
 * - closing a session destroys its WebContents and closes never-transferred ports, so
 *   restarts cannot leak WebContents or MessagePorts;
 * - a WebContents destroyed externally (crash, `destroy()` from elsewhere) is forgotten
 *   and reported, keeping the tracking map honest.
 *
 * Container WebContents always run with `contextIsolation: true`,
 * `nodeIntegration: false`, `sandbox: true`: the tool realm has no Node and no
 * `ipcRenderer` — its only bridge is the fixed port-handoff channel.
 */
import { BRIDGE } from '../shared/bridge-protocol.ts';

/** Structural subset of Electron's WebContents the realm manager relies on. */
export interface RealmBounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface ContainerWebContents {
	loadURL(url: string): Promise<void>;
	/** Transfers MessagePortMain objects into the renderer (one-time port handoff). */
	postMessage(channel: string, message?: unknown, transfer?: unknown[]): void;
	isDestroyed(): boolean;
	destroy(): void;
	on(event: 'destroyed', listener: () => void): unknown;
	executeJavaScript(code: string): Promise<unknown>;
	getURL(): string;
	/** Attaches/positions the visible child view in the Host window. */
	setBounds(bounds: RealmBounds): void;
}

export interface WebContentsFactory {
	create(options: {
		webPreferences: {
			sandbox: boolean;
			contextIsolation: boolean;
			nodeIntegration: boolean;
		};
	}): ContainerWebContents;
}

export interface RealmMessagePort {
	postMessage(message: unknown, transfer?: unknown[]): void;
	start(): void;
	/** Idempotent; safe to call on already-closed/never-transferred ports. */
	close(): void;
}

export interface MessageChannelFactory {
	create(): { port1: RealmMessagePort; port2: RealmMessagePort };
}

export interface RealmDiagnostics {
	/** Emits a typed diagnostic for unexpected realm events (external destroy, load failure). */
	(severity: 'error' | 'warning' | 'info', code: string, message: string, sessionId?: string): void;
}

export interface RealmHandle {
	sessionId: string;
	endpoint: 'main' | 'slate';
	/** The container WebContents (destroyed by the manager, never by callers). */
	readonly webContents: ContainerWebContents;
	/**
	 * The Host-side port, to be transferred into the Host UI renderer exactly once via
	 * `hostWindow.webContents.postMessage(BRIDGE.portHandoff, payload, [port])`.
	 */
	readonly hostPort: RealmMessagePort;
}

interface TrackedRealm {
	handle: RealmHandle;
	destroyed: boolean;
	/** Channel the port handoff used; kept for diagnostics only. */
	containerPortChannel: string;
}

export class ToolRealmManager {
	private readonly realms = new Map<string, TrackedRealm>(); // `${sessionId}::${endpoint}`
	private readonly sessionRealms = new Map<string, Set<string>>();

	constructor(
		private readonly webContentsFactory: WebContentsFactory,
		private readonly channelFactory: MessageChannelFactory,
		private readonly diagnostic: RealmDiagnostics = () => {}
	) {}

	/** Opens a container realm: secure WebContents + channel + one-time port handoff. */
	async openRealm(options: {
		sessionId: string;
		endpoint: 'main' | 'slate';
		/** Container page URL under the cache protocol (query carries entry + endpoint). */
		containerUrl: string;
		bounds: RealmBounds;
	}): Promise<RealmHandle> {
		const key = `${options.sessionId}::${options.endpoint}`;
		if (this.realms.has(key)) {
			throw new Error(`realm already open for session '${options.sessionId}' endpoint '${options.endpoint}'`);
		}

		const webContents = this.webContentsFactory.create({
			webPreferences: {
				// Tool realm hardening: no Node, no arbitrary IPC. The only bridge is the
				// fixed `BRIDGE.portHandoff` channel delivered through the container preload.
				sandbox: true,
				contextIsolation: true,
				nodeIntegration: false
			}
		});

		webContents.setBounds(options.bounds);
		const channel = this.channelFactory.create();

		const handle: RealmHandle = {
			sessionId: options.sessionId,
			endpoint: options.endpoint,
			webContents,
			hostPort: channel.port2
		};
		const tracked: TrackedRealm = { handle, destroyed: false, containerPortChannel: BRIDGE.portHandoff };
		this.realms.set(key, tracked);
		this.sessionRealms.set(options.sessionId, (this.sessionRealms.get(options.sessionId) ?? new Set()).add(key));

		webContents.on('destroyed', () => {
			if (!tracked.destroyed) {
				tracked.destroyed = true;
				this.forget(key);
				this.diagnostic('warning', 'realm/webcontents-destroyed', `container WebContents destroyed externally (${options.endpoint})`, options.sessionId);
			}
		});

		try {
			// Navigation must finish before the one-time transfer; otherwise the initial
			// document receives the port and loses it when the container page replaces it.
			await webContents.loadURL(options.containerUrl);
			channel.port1.start();
			webContents.postMessage(BRIDGE.portHandoff, { endpoint: options.endpoint }, [channel.port1]);
			return handle;
		} catch (err) {
			this.diagnostic('warning', 'realm/load-failed', `container page load failed: ${err instanceof Error ? err.message : String(err)}`, options.sessionId);
			channel.port1.close();
			channel.port2.close();
			if (!webContents.isDestroyed()) webContents.destroy();
			tracked.destroyed = true;
			this.forget(key);
			throw err;
		}
	}

	/** Destroys one endpoint without disturbing the other realm. Idempotent. */
	closeRealm(sessionId: string, endpoint: 'main' | 'slate'): void {
		const key = `${sessionId}::${endpoint}`;
		const tracked = this.realms.get(key);
		if (tracked === undefined) return;
		tracked.handle.hostPort.close();
		tracked.destroyed = true;
		if (!tracked.handle.webContents.isDestroyed()) tracked.handle.webContents.destroy();
		this.forget(key);
	}

	setBounds(sessionId: string, endpoint: 'main' | 'slate', bounds: RealmBounds): void {
		this.realms.get(`${sessionId}::${endpoint}`)?.handle.webContents.setBounds(bounds);
	}

	/** Destroys every realm of a session (Restart, Reload, Close). Idempotent. */
	closeSession(sessionId: string): void {
		for (const key of this.sessionRealms.get(sessionId) ?? []) {
			const tracked = this.realms.get(key);
			if (tracked === undefined) continue;
			this.closeRealm(sessionId, tracked.handle.endpoint);
		}
		this.sessionRealms.delete(sessionId);
	}

	/** Destroys everything (app quit). Returns the number of realms torn down. */
	closeAll(): number {
		const sessions = [...this.sessionRealms.keys()];
		for (const sessionId of sessions) this.closeSession(sessionId);
		return sessions.length;
	}

	get openRealmCount(): number {
		return this.realms.size;
	}

	hasRealm(sessionId: string, endpoint: 'main' | 'slate'): boolean {
		return this.realms.has(`${sessionId}::${endpoint}`);
	}

	/** The live container WebContents of one realm (used to resolve container blob URLs). */
	getRealmWebContents(sessionId: string, endpoint: 'main' | 'slate'): ContainerWebContents | undefined {
		return this.realms.get(`${sessionId}::${endpoint}`)?.handle.webContents;
	}

	private forget(key: string): void {
		this.realms.delete(key);
		const sessionId = key.split('::')[0] as string;
		this.sessionRealms.get(sessionId)?.delete(key);
	}
}
