/**
 * Desktop Main-process wiring: implements the bridge protocol handlers over the
 * Desktop services (Open Project, Forge build, Catalog, realms, asset/export
 * adapters). The whole map is testable with injected fakes — the thin
 * `electron-main.ts` entry only supplies real Electron objects and window lifecycle.
 *
 * Guarantees enforced here:
 * - renderers never receive filesystem paths (only `deshelf-cache://` URLs and
 *   opaque handles);
 * - Tool Container realms are sandboxed WebContents with exactly one transferred
 *   MessagePort; Environment traffic never re-enters Main;
 * - closing/restarting a session releases realms, ports and picked asset bytes.
 */
import { randomUUID } from 'node:crypto';
import type { CatalogEntry, Diagnostic } from 'tool-contract';
import {
	BRIDGE,
	type AssetPickRequest,
	type AssetPickResult,
	type AssetUrlRequest,
	type AssetUrlResult,
	type BuildProjectRequest,
	type BuildProjectResult,
	type BuildToolInfo,
	type CatalogListResult,
	type CloseToolSessionRequest,
	type ExportSaveRequest,
	type ExportSaveResult,
	type OpenProjectResult,
	type OpenToolSessionRequest,
	type OpenToolSessionResult,
	type ProjectLocationInfo
} from '../shared/bridge-protocol.ts';
import { SessionAssetStore, pickAsset, type AssetFileDialog } from './asset-store.ts';
import type { SaveFileDialog } from './export-writer.ts';
import { saveExport } from './export-writer.ts';
import type { DesktopBuilderService } from './builder-service.ts';
import type { ProjectLocation } from './project-location.ts';
import { openProjectViaDialog, readProjectLocation } from './project-location.ts';
import type { ToolRealmManager } from './realms.ts';
/** Transfers the Host-side port end into the Host UI renderer (one-time handoff). */
export interface HostPortTarget {
	postMessage(channel: string, message?: unknown, transfer?: unknown[]): void;
}

export interface DesktopAppDeps {
	dialog: AssetFileDialog & SaveFileDialog;
	readonly cacheRoot: string;
	builder: DesktopBuilderService;
	realms: ToolRealmManager;
	/** Where the Host UI renderer lives (port handoff target). */
	hostPortTarget: HostPortTarget;
	/** Resolves container-owned blob: URLs into data: URLs (executeJavaScript realm). */
	resolveContainerBlob?: (blobUrl: string) => Promise<string>;
}

/** Handler methods, keyed by bridge method name (see `BRIDGE_METHOD_TO_CHANNEL`). */
export interface DesktopBridgeHandlers {
	openProject(): Promise<OpenProjectResult>;
	buildProject(request: BuildProjectRequest): Promise<BuildProjectResult>;
	listCatalog(): Promise<CatalogListResult>;
	openToolSession(request: OpenToolSessionRequest): Promise<OpenToolSessionResult>;
	closeToolSession(request: CloseToolSessionRequest): Promise<{ ok: boolean }>;
	assetPick(request: AssetPickRequest & { kind?: string }): Promise<AssetPickResult>;
	assetUrl(request: AssetUrlRequest): Promise<AssetUrlResult>;
	exportSave(request: ExportSaveRequest): Promise<ExportSaveResult>;
}

/** Registers each handler under its fixed IPC channel name. */
export const BRIDGE_METHOD_TO_CHANNEL: Readonly<Record<keyof DesktopBridgeHandlers, string>> = {
	openProject: BRIDGE.openProject,
	buildProject: BRIDGE.buildProject,
	listCatalog: BRIDGE.listCatalog,
	openToolSession: BRIDGE.openToolSession,
	closeToolSession: BRIDGE.closeToolSession,
	assetPick: BRIDGE.assetPick,
	assetUrl: BRIDGE.assetUrl,
	exportSave: BRIDGE.exportSave
};

function toDiagnosticList(diagnostics: readonly Diagnostic[]): BuildProjectResult['diagnostics'] {
	return diagnostics.map((d) => ({ severity: d.severity, code: d.code, message: d.message }));
}

function toolInfos(entries: readonly { entry: { catalogEntryId: string; projectId: string; slug: string; name: string; surfaces: { canvas: true; slate: boolean } } }[]): BuildToolInfo[] {
	return entries.map(({ entry }) => ({
		catalogEntryId: entry.catalogEntryId,
		projectId: entry.projectId,
		slug: entry.slug,
		name: entry.name,
		surfaces: entry.surfaces
	}));
}

/** Creates the full bridge handler map. Callers register each handler under its channel. */
export function createDesktopBridge(deps: DesktopAppDeps): DesktopBridgeHandlers {
	const assets = new SessionAssetStore();
	const lastLocation = new Map<string, ProjectLocation>();

	async function loadLocation(projectLocationId: string): Promise<ProjectLocation | undefined> {
		const info = await deps.builder.catalogs.getLocation(projectLocationId);
		if (info === undefined) return undefined;
		const reloaded = await readProjectLocation(info.projectDir);
		if (reloaded.ok) {
			lastLocation.set(projectLocationId, reloaded.location);
			return reloaded.location;
		}
		return lastLocation.get(projectLocationId);
	}

	return {
		async openProject(): Promise<OpenProjectResult> {
			const result = await openProjectViaDialog(deps.dialog);
			if (!result.ok) return { location: null };
			await deps.builder.catalogs.rememberLocation(result.location.info);
			return { location: result.location.info };
		},

		async buildProject({ projectLocationId }): Promise<BuildProjectResult> {
			const location = await loadLocation(projectLocationId);
			if (location === undefined) {
				return { ok: false, fromCache: false, diagnostics: [{ severity: 'error', code: 'project/unknown-location', message: `unknown project location '${projectLocationId}'` }], tools: [] };
			}
			const outcome = await deps.builder.build(location);
			return {
				ok: outcome.ok,
				fromCache: outcome.fromCache,
				diagnostics: toDiagnosticList(outcome.diagnostics),
				tools: outcome.entry !== undefined ? toolInfos([{ entry: outcome.entry }]) : []
			};
		},

		async listCatalog(): Promise<CatalogListResult> {
			const records = await deps.builder.catalogs.listRecords();
			const locations: Record<string, ProjectLocationInfo> = {};
			const tools: BuildToolInfo[] = [];
			const entries: CatalogEntry[] = [];
			for (const record of records) {
				locations[record.entry.catalogEntryId] = record.location;
				tools.push(...toolInfos([record]));
				entries.push(record.entry);
			}
			return { tools, locations, entries };
		},

		async openToolSession(request): Promise<OpenToolSessionResult> {
			const record = await deps.builder.catalogs.getRecord(request.catalogEntryId);
			if (record === undefined) throw new Error(`unknown catalog entry '${request.catalogEntryId}'`);
			const locationId = record.location.projectLocationId;
			const sourceHash = await deps.builder.catalogs.getCurrentBuild(locationId);
			if (sourceHash === undefined) throw new Error(`project location '${locationId}' has no published build`);

			const endpoint = request.endpoint ?? 'main';
			const sessionId = request.sessionId ?? randomUUID();
			const containerUrl = deps.builder.containerUrlFor(locationId, sourceHash);
			const pageUrl = deps.builder.containerPageUrl(containerUrl, record.entry.artifacts.main, endpoint);

			const realm = await deps.realms.openRealm({ sessionId, endpoint, containerUrl: pageUrl });
			// One-time handoff of the Host-side port end into the Host UI renderer. All
			// subsequent Environment traffic flows over the port pair, never via IPC.
			deps.hostPortTarget.postMessage(BRIDGE.portHandoff, { sessionId, endpoint }, [realm.hostPort]);

			const containerUrls: Record<string, string> = {
				[endpoint]: deps.builder.containerPageUrl(containerUrl, record.entry.artifacts.main, endpoint)
			};
			if (endpoint === 'main' && record.entry.surfaces.slate) {
				containerUrls.slate = deps.builder.containerPageUrl(containerUrl, record.entry.artifacts.slate ?? record.entry.artifacts.main, 'slate');
			}
			return {
				sessionId,
				endpoints: endpoint === 'main' ? ['main'] : ['slate'],
				containerUrls,
				inventory: { assets: Object.keys(record.entry.assets), exports: Object.keys(record.entry.outputs) }
			};
		},

		async closeToolSession({ sessionId }): Promise<{ ok: boolean }> {
			deps.realms.closeSession(sessionId);
			assets.releaseSession(sessionId);
			return { ok: true };
		},

		async assetPick({ sessionId, title, kind }): Promise<AssetPickResult> {
			const picked = await pickAsset(deps.dialog, assets, sessionId, { title, kind });
			if (picked === undefined) return { ok: false };
			return { ok: true, handle: picked.handle, mime: picked.mime };
		},

		async assetUrl({ sessionId, handle }): Promise<AssetUrlResult> {
			const asset = assets.get(handle);
			if (asset === undefined || asset.sessionId !== sessionId) {
				throw new Error(`unknown asset handle for session '${sessionId}'`);
			}
			const url = assets.urlFor(handle);
			return { url: url as string, mime: asset.mime };
		},

		async exportSave(request): Promise<ExportSaveResult> {
			const resolveBlob = deps.resolveContainerBlob ?? ((blobUrl: string) => resolveViaRealm(deps.realms, request.sessionId, blobUrl));
			return saveExport({
				content: request.content,
				mime: request.mime,
				suggestedName: request.suggestedName,
				dialog: deps.dialog,
				resolveBlob
			});
		}
	};

	function resolveViaRealm(realms: ToolRealmManager, sessionId: string, blobUrl: string): Promise<string> {
		// Runs INSIDE the container realm's origin, so container-owned blob: URLs resolve
		// without any filesystem path or cross-origin transfer. The bytes arrive as a
		// data: URL in Main, where the save dialog + disk write happen.
		const realm = realms.getRealmWebContents(sessionId, 'main');
		if (realm === undefined) throw new Error(`no main realm for session '${sessionId}'`);
		const code = `(async () => {
			const response = await fetch(${JSON.stringify(blobUrl)});
			const blob = await response.blob();
			return await new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(String(reader.result));
				reader.onerror = () => reject(new Error('blob read failed'));
				reader.readAsDataURL(blob);
			});
		})()`;
		return realm.executeJavaScript(code) as Promise<string>;
	}
}

/** Flushes everything on app quit (realms, ports, asset bytes). */
export function disposeDesktopBridge(deps: Pick<DesktopAppDeps, 'realms'>): void {
	deps.realms.closeAll();
}
