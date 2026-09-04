/**
 * Deshelf Desktop Host↔Main bridge protocol.
 *
 * This is the ONLY surface the Host UI renderer and the Tool Container renderers can
 * reach. Every channel is a fixed, named, typed request — the preload scripts expose
 * these individually through `contextBridge`; renderers never see `ipcRenderer` or Node.
 * MessagePort transfers use one dedicated `webContents.postMessage` channel; all ongoing
 * Environment traffic flows over the transferred port pair and never re-enters IPC.
 */
import type { CatalogEntry } from 'tool-contract';


export const BRIDGE = {
	/** Host renderer asks Main to show the Open Project directory dialog. */
	openProject: 'deshelf:open-project',
	/** Host renderer asks Main to build the Open Project into the AppData cache. */
	buildProject: 'deshelf:build-project',
	/** Host renderer asks Main for the persisted Desktop Catalog entries. */
	listCatalog: 'deshelf:list-catalog',
	/** Host renderer opens a Tool Session realm; the port is transferred separately. */
	openToolSession: 'deshelf:open-tool-session',
	/** Host renderer closes a Tool Session realm or one optional endpoint. */
	closeToolSession: 'deshelf:close-tool-session',
	/** Host renderer positions a visible Tool WebContentsView over its surface host. */
	setToolSurfaceBounds: 'deshelf:set-tool-surface-bounds',
	/** One-time WebContents.postMessage channel that transfers the renderer-side port. */
	portHandoff: 'deshelf:port',
	/** Host renderer asks Main to show the Asset Input file dialog. */
	assetPick: 'deshelf:asset-pick',
	/** Host renderer asks Main to resolve an asset handle into a container-fetchable URL. */
	assetUrl: 'deshelf:asset-url',
	/** Host renderer asks Main to show the save dialog and write the exported bytes. */
	exportSave: 'deshelf:export-save',
	/** Main pushes diagnostics/logs to the Host renderer. */
	diagnostics: 'deshelf:diagnostics'
} as const;

export type BridgeChannel = (typeof BRIDGE)[keyof typeof BRIDGE];

// ---------------------------------------------------------------------------
// Payloads
// ---------------------------------------------------------------------------

/** Serializable projection of a validated Open Project location. */
export interface ProjectLocationInfo {
	projectLocationId: string;
	/** Absolute path of the Open Project on disk. Never leaves the Main process except here (Host chrome display only). */
	projectDir: string;
	projectId: string;
	slug: string;
	name: string;
	version: string;
	forgeProfile: string;
	libraries: readonly string[];
}

export interface OpenProjectResult {
	location: ProjectLocationInfo | null;
}

export interface BuildProjectRequest {
	projectLocationId: string;
}

export interface BuildToolInfo {
	catalogEntryId: string;
	projectId: string;
	slug: string;
	name: string;
	surfaces: { canvas: true; slate: boolean };
}

export interface BuildProjectResult {
	ok: boolean;
	diagnostics: ReadonlyArray<{ severity: string; code: string; message: string }>;
	fromCache: boolean;
	tools: BuildToolInfo[];
}

export interface CatalogListResult {
	tools: BuildToolInfo[];
	/** The location each tool belongs to, keyed by catalogEntryId (multi-Location display). */
	locations: Record<string, ProjectLocationInfo>;
	/** Full Catalog Entries for Host-side session creation (descriptors only). */
	entries: CatalogEntry[];
}

export interface ToolSurfaceBounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface OpenToolSessionRequest {
	catalogEntryId: string;
	/**
	 * Open an ADDITIONAL endpoint for an existing session (Slate boot after Ready).
	 * When omitted, Main issues a new session id and opens the Main realm.
	 */
	sessionId?: string;
	/** Defaults to 'main' for new sessions; required when `sessionId` is set. */
	endpoint?: 'main' | 'slate';
	bounds: ToolSurfaceBounds;
}

export interface OpenToolSessionResult {
	sessionId: string;
	endpoints: ReadonlyArray<'main' | 'slate'>;
	/** Container page URLs per endpoint, resolved against the deshelf-cache:// protocol. */
	containerUrls: Record<string, string>;
	/** Opaque asset slot ids the environment can supply. */
	inventory: { assets: readonly string[]; exports: readonly string[] };
}

export interface CloseToolSessionRequest {
	sessionId: string;
	/** Omit to close the whole session; Slate failures close only the Slate realm. */
	endpoint?: 'main' | 'slate';
}

export interface SetToolSurfaceBoundsRequest {
	sessionId: string;
	endpoint: 'main' | 'slate';
	bounds: ToolSurfaceBounds;
}

export interface PortHandoffPayload {
	sessionId: string;
	endpoint: 'main' | 'slate';
}

export interface AssetPickRequest {
	sessionId: string;
	/** Human-facing title for the file dialog (Host chrome text). */
	title: string;
}

export interface AssetPickResult {
	ok: boolean;
	/** Opaque handle — never a filesystem path. */
	handle?: string;
	mime?: string;
}

export interface AssetUrlRequest {
	sessionId: string;
	handle: string;
}

export interface AssetUrlResult {
	/** Container-fetchable URL under deshelf-cache://session-assets/<sessionId>/<handle>. */
	url: string;
	mime: string;
}

export interface ExportSaveRequest {
	sessionId: string;
	outputId: string;
	/** Default file name derived from the Visual Output descriptor + tool slug. */
	suggestedName: string;
	mime: string;
	content: { kind: string; url?: string; data?: string };
}

export interface ExportSaveResult {
	ok: boolean;
	canceled?: boolean;
	error?: string;
}

// ---------------------------------------------------------------------------
// Handler map: the entire Main-process surface, testable without Electron.
// ---------------------------------------------------------------------------

export type BridgeHandlers = {
	[BRIDGE.openProject]: () => Promise<OpenProjectResult>;
	[BRIDGE.buildProject]: (request: BuildProjectRequest) => Promise<BuildProjectResult>;
	[BRIDGE.listCatalog]: () => Promise<CatalogListResult>;
	[BRIDGE.openToolSession]: (request: OpenToolSessionRequest) => Promise<OpenToolSessionResult>;
	[BRIDGE.closeToolSession]: (request: CloseToolSessionRequest) => Promise<{ ok: boolean }>;
	[BRIDGE.setToolSurfaceBounds]: (request: SetToolSurfaceBoundsRequest) => Promise<{ ok: boolean }>;
	[BRIDGE.assetPick]: (request: AssetPickRequest) => Promise<AssetPickResult>;
	[BRIDGE.assetUrl]: (request: AssetUrlRequest) => Promise<AssetUrlResult>;
	[BRIDGE.exportSave]: (request: ExportSaveRequest) => Promise<ExportSaveResult>;
};
