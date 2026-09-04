/**
 * Deshelf Desktop preload for TOOL CONTAINER WebContents.
 *
 * Hardening contract (Acceptance: "Runtime 无 Node 与任意 ipcRenderer"):
 * - the container realm runs with `sandbox: true`, `contextIsolation: true`,
 *   `nodeIntegration: false`;
 * - this preload exposes EXACTLY ONE capability: receiving the one-time MessagePort
 *   handoff. There is no Node, no arbitrary `ipcRenderer`, no invoke channel, and no
 *   way for Tool code to reach the Main process directly.
 */
import { contextBridge, ipcRenderer } from 'electron';
import { createPreloadPortFacade } from '../transport/preload-port-facade.ts';
import type { PortLike } from '../transport/port-transport.ts';

contextBridge.exposeInMainWorld('DeshelfContainer', {
	onPort(callback: (port: PortLike) => void): void {
		if (typeof callback !== 'function') return;
		ipcRenderer.on('deshelf:port', (event) => {
			const [port] = event.ports;
			if (port !== undefined) callback(createPreloadPortFacade(port));
		});
	}
});
