/**
 * EnvironmentTransport: the only seam adapters implement. Web uses a same-origin iframe
 * adapter, Desktop uses WebContents + MessagePort; both conform to this interface. The
 * endpoint role (main | slate) is determined by which channel the transport belongs to,
 * never by the messages themselves.
 */
import type { EnvironmentEnvelope } from './environment.ts';

export type Unsubscribe = () => void;

export interface EnvironmentTransport {
	send(message: EnvironmentEnvelope): void;
	subscribe(handler: (message: EnvironmentEnvelope) => void): Unsubscribe;
	close(): void;
}

export interface InMemoryTransportPair {
	host: EnvironmentTransport;
	container: EnvironmentTransport;
}

/**
 * Two-ended in-memory channel used by deterministic tests and as the base harness for
 * shared Environment API conformance tests. `host`-side sends are delivered to `container`
 * subscribers and vice versa. After `close()` no further messages are delivered.
 */
export function createInMemoryTransportPair(): InMemoryTransportPair {
	let closed = false;
	const hostHandlers = new Set<(message: EnvironmentEnvelope) => void>();
	const containerHandlers = new Set<(message: EnvironmentEnvelope) => void>();

	const deliver = (handlers: Set<(message: EnvironmentEnvelope) => void>, message: EnvironmentEnvelope): void => {
		if (closed) return;
		for (const handler of [...handlers]) {
			handler(message);
		}
	};

	return {
		host: {
			send(message: EnvironmentEnvelope): void {
				deliver(containerHandlers, message);
			},
			subscribe(handler: (message: EnvironmentEnvelope) => void): Unsubscribe {
				hostHandlers.add(handler);
				return () => hostHandlers.delete(handler);
			},
			close(): void {
				closed = true;
				hostHandlers.clear();
				containerHandlers.clear();
			}
		},
		container: {
			send(message: EnvironmentEnvelope): void {
				deliver(hostHandlers, message);
			},
			subscribe(handler: (message: EnvironmentEnvelope) => void): Unsubscribe {
				containerHandlers.add(handler);
				return () => containerHandlers.delete(handler);
			},
			close(): void {
				closed = true;
				hostHandlers.clear();
				containerHandlers.clear();
			}
		}
	};
}

/** Recording wrapper for assertions: every delivered message is appended in order. */
export function recordTransport(transport: EnvironmentTransport): EnvironmentTransport & { messages: EnvironmentEnvelope[] } {
	const messages: EnvironmentEnvelope[] = [];
	transport.subscribe((message) => messages.push(message));
	return Object.assign(transport, { messages });
}