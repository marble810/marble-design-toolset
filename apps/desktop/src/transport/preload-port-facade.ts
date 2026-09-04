import type { PortLike } from './port-transport.ts';

/**
 * Structural subset of the real renderer MessagePort received by an Electron preload.
 * The facade is required because contextBridge cannot preserve native prototype methods
 * when a MessagePort is passed directly into the isolated page world.
 */
export interface PreloadMessagePort {
	postMessage(message: unknown): void;
	start(): void;
	close(): void;
	addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
	removeEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
}

/** Returns a plain, contextBridge-cloneable object whose functions proxy the native port. */
export function createPreloadPortFacade(port: PreloadMessagePort): PortLike {
	const listeners = new Map<(event: { data: unknown }) => void, (event: { data: unknown }) => void>();
	return {
		postMessage: (message) => port.postMessage(message),
		start: () => port.start(),
		close: () => {
			for (const wrapped of listeners.values()) port.removeEventListener('message', wrapped);
			listeners.clear();
			port.close();
		},
		addEventListener: (_type, listener) => {
			if (listeners.has(listener)) return;
			const wrapped = (event: { data: unknown }): void => listener({ data: event.data });
			listeners.set(listener, wrapped);
			port.addEventListener('message', wrapped);
		},
		removeEventListener: (_type, listener) => {
			const wrapped = listeners.get(listener);
			if (wrapped === undefined) return;
			listeners.delete(listener);
			port.removeEventListener('message', wrapped);
		}
	};
}
