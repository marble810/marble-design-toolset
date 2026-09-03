/**
 * Deshelf Desktop Electron entry (thin): supplies real Electron objects to the testable
 * `createDesktopBridge` wiring and owns window/app lifecycle. All logic lives in the
 * injected services — this file stays small enough to review at a glance.
 *
 * Security posture of every window:
 * - Tool Container WebContents (created by ToolRealmManager): sandbox, contextIsolation,
 *   no Node, preload = preload-container.ts (port handoff only).
 * - Host UI window: contextIsolation, no Node integration, preload = preload-host.ts
 *   (typed bridge only).
 */
import { app, BrowserWindow, dialog, ipcMain, MessageChannelMain, protocol, webContents, type MessagePortMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCachePaths, CACHE_PROTOCOL } from './paths.ts';
import { DesktopBuilderService } from './builder-service.ts';
import { DesktopCatalogService } from './catalog-service.ts';
import { createDesktopBridge, BRIDGE_METHOD_TO_CHANNEL, disposeDesktopBridge } from './desktop-app.ts';
import { createDevForgeProfileResolver } from './forge-resources.ts';
import { ToolRealmManager, type ContainerWebContents } from './realms.ts';
import type { AssetFileDialog } from './asset-store.ts';
import type { SaveFileDialog } from './export-writer.ts';
import { privilegedCacheScheme, resolveCacheUrl } from './resource-protocol.ts';
import { InProcessBuildExecutor } from './controlled-build.ts';
import { BRIDGE } from '../shared/bridge-protocol.ts';

const dirname = path.dirname(fileURLToPath(import.meta.url));

protocol.registerSchemesAsPrivileged([privilegedCacheScheme()]);

// The container bootstrap entry is bundled at packaging time; in this repository the
// TS entry works directly (bun/node execute TS, dev only).
const BOOTSTRAP_ENTRY = path.resolve(dirname, '../container/bootstrap.ts');
const CACHE_ROOT = path.join(app.getPath('userData'), 'deshelf-forge');
const paths = createCachePaths(CACHE_ROOT);

const catalog = new DesktopCatalogService(CACHE_ROOT);
const builder = new DesktopBuilderService(CACHE_ROOT, {
	executor: new InProcessBuildExecutor(),
	resolveForgeProfile: createDevForgeProfileResolver(),
	bootstrapEntry: BOOTSTRAP_ENTRY,
	catalog,
	log: (message) => console.log(message)
});
const realms = new ToolRealmManager(
	{
		create: (options) => {
			const create = (webContents as unknown as { create: (o: unknown) => ContainerWebContents }).create;
			return create({
				webPreferences: {
					sandbox: options.webPreferences.sandbox,
					contextIsolation: options.webPreferences.contextIsolation,
					nodeIntegration: options.webPreferences.nodeIntegration,
					preload: path.join(dirname, 'preload-container.js')
				}
			});
		}
	},
	{ create: () => new MessageChannelMain() },
	(severity, code, message, sessionId) => console.warn(`[realm${sessionId !== undefined ? ` ${sessionId}` : ''}] ${severity} ${code}: ${message}`)
);

const bridge = createDesktopBridge({
	dialog: dialog as unknown as AssetFileDialog & SaveFileDialog,
	cacheRoot: CACHE_ROOT,
	builder,
	realms,
	hostPortTarget: {
		postMessage: (channel, message, transfer) => {
			// The Host UI window is the single port-handoff target.
			const window = BrowserWindow.getAllWindows()[0];
			window?.webContents.postMessage(channel, message, transfer as MessagePortMain[]);
		}
	}
});

for (const [method, handler] of Object.entries(bridge)) {
	const channel = BRIDGE_METHOD_TO_CHANNEL[method as keyof typeof BRIDGE_METHOD_TO_CHANNEL];
	if (channel === undefined) continue;
	ipcMain.handle(channel, (_event, request: unknown) => (handler as (request: unknown) => unknown)(request));
}

function createHostWindow(): BrowserWindow {
	const window = new BrowserWindow({
		width: 1440,
		height: 900,
		title: 'Deshelf Desktop',
		show: false,
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false, // the typed Host preload needs ipcRenderer.invoke via contextBridge
			preload: path.join(dirname, 'preload-host.js')
		}
	});
	window.loadFile(path.join(dirname, '../../ui/index.html'));
	window.once('ready-to-show', () => window.show());
	return window;
}

app.whenReady().then(() => {
	protocol.handle(CACHE_PROTOCOL, async (request) => {
		const resolved = resolveCacheUrl(CACHE_ROOT, request.url);
		if (resolved === undefined) return new Response('not found', { status: 404 });
		try {
			const { readFile } = await import('node:fs/promises');
			const bytes = await readFile(resolved.absolutePath);
			return new Response(bytes as unknown as BodyInit, { headers: { 'content-type': resolved.contentType } });
		} catch {
			return new Response('not found', { status: 404 });
		}
	});
	createHostWindow();
});

app.on('window-all-closed', () => {
	disposeDesktopBridge({ realms });
	if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => disposeDesktopBridge({ realms }));

export { BRIDGE };
