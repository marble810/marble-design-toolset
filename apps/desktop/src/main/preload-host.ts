/**
 * Deshelf Desktop preload for the HOST UI renderer.
 *
 * Exposes the fixed bridge protocol (bridge-protocol.ts) as typed functions through
 * `contextBridge`. The renderer never touches `ipcRenderer` or Node: each capability is
 * an individually exposed function bound to one named channel, and the only event push
 * is the one-time MessagePort handoff.
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { BRIDGE } from '../shared/bridge-protocol.ts';

contextBridge.exposeInMainWorld('DeshelfHost', {
	openProject: () => ipcRenderer.invoke(BRIDGE.openProject),
	buildProject: (request: { projectLocationId: string }) => ipcRenderer.invoke(BRIDGE.buildProject, request),
	listCatalog: () => ipcRenderer.invoke(BRIDGE.listCatalog),
	openToolSession: (request: { catalogEntryId: string; sessionId?: string; endpoint?: 'main' | 'slate' }) =>
		ipcRenderer.invoke(BRIDGE.openToolSession, request),
	closeToolSession: (request: { sessionId: string }) => ipcRenderer.invoke(BRIDGE.closeToolSession, request),
	pickAsset: (request: { sessionId: string; title: string }) => ipcRenderer.invoke(BRIDGE.assetPick, request),
	assetUrl: (request: { sessionId: string; handle: string }) => ipcRenderer.invoke(BRIDGE.assetUrl, request),
	exportSave: (request: unknown) => ipcRenderer.invoke(BRIDGE.exportSave, request),
	onPortHandoff: (handler: (payload: { sessionId: string; endpoint: 'main' | 'slate' }, port: MessagePort) => void): (() => void) => {
		const listener = (event: IpcRendererEvent, payload: { sessionId: string; endpoint: 'main' | 'slate' }): void => {
			const [port] = event.ports;
			if (port !== undefined) handler(payload, port);
		};
		ipcRenderer.on(BRIDGE.portHandoff, listener);
		return () => ipcRenderer.off(BRIDGE.portHandoff, listener);
	}
});
