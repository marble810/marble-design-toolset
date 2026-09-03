/**
 * EnvironmentTransport over a MessagePort pair (Desktop).
 *
 * In Deshelf Desktop the Host UI renderer and the Tool Container renderer exchange
 * Environment envelopes over the two ends of one MessageChannel that the Main process
 * created and transferred exactly once (`BRIDGE.portHandoff`). After the handoff the
 * Main process never sees the traffic — messages flow renderer↔renderer through the
 * port, never via per-message IPC forwarding.
 *
 * The same implementation wraps both ends: a MessagePort is point-to-point, so the
 * endpoint role (main | slate) comes from which channel the port belongs to, never from
 * the messages. This matches the Web iframe adapter, where the role comes from which
 * iframe the transport belongs to.
 */
import type { EnvironmentEnvelope, EnvironmentTransport, Unsubscribe } from 'tool-contract';

/**
 * Structural view of a renderer-side MessagePort (HTML MessagePort semantics):
 * messages posted before `start()` are queued by the platform and delivered after it.
 */
export interface PortLike {
	postMessage(message: unknown): void;
	start(): void;
	close(): void;
	addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
	removeEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
}

export function createPortTransport(port: PortLike): EnvironmentTransport {
	const handlers = new Set<(message: EnvironmentEnvelope) => void>();
	let closed = false;

	const onMessage = (event: { data: unknown }): void => {
		if (closed) return;
		for (const handler of [...handlers]) handler(event.data as EnvironmentEnvelope);
	};
	port.addEventListener('message', onMessage);
	// Begin delivery immediately: envelopes sent before this transport existed (e.g. the
	// Host boot request racing the container document) are queued by the platform and
	// flushed in order now.
	port.start();

	return {
		send(message: EnvironmentEnvelope): void {
			if (closed) return;
			port.postMessage(message);
		},
		subscribe(handler: (message: EnvironmentEnvelope) => void): Unsubscribe {
			handlers.add(handler);
			return () => handlers.delete(handler);
		},
		close(): void {
			if (closed) return;
			closed = true;
			handlers.clear();
			port.removeEventListener('message', onMessage);
			port.close();
		}
	};
}
