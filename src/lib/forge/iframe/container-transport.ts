/**
 * Container-side end of the same-origin iframe transport (runs INSIDE the Tool
 * Container document). Sends envelopes to `window.parent` and accepts only messages
 * whose `source` is the parent window and whose `origin` matches the shared origin.
 *
 * Same origin as the Host is a supply decision (pre-compiled artifacts + Forge
 * Framework Libraries are served from the same app), not an isolation promise.
 */
import type { EnvironmentEnvelope, EnvironmentTransport, Unsubscribe } from 'tool-contract';
import type { IncomingMessageEvent, MessageEventTarget, PostMessageTarget } from './dom.js';

export interface IframeContainerTransportOptions {
	/** The parent window (normally `window.parent`). */
	parent: PostMessageTarget;
	/** This container's window (normally the global `window`). */
	listen: MessageEventTarget;
	/** The shared same-origin. */
	origin: string;
	/** Called when a message arrives from an unexpected source/origin. */
	onRejectedMessage?: (reason: string) => void;
}

export function createIframeContainerTransport(options: IframeContainerTransportOptions): EnvironmentTransport {
	const { parent, listen, origin } = options;
	const handlers = new Set<(message: EnvironmentEnvelope) => void>();
	let closed = false;

	function onMessage(event: IncomingMessageEvent): void {
		if (closed) return;
		if (event.source !== parent) {
			options.onRejectedMessage?.('message source is not the parent window');
			return;
		}
		if (event.origin !== origin) {
			options.onRejectedMessage?.(`message origin '${event.origin}' is not '${origin}'`);
			return;
		}
		for (const handler of [...handlers]) handler(event.data as EnvironmentEnvelope);
	}
	listen.addEventListener('message', onMessage);

	return {
		send(message: EnvironmentEnvelope): void {
			if (closed) return;
			parent.postMessage(message, origin);
		},
		subscribe(handler: (message: EnvironmentEnvelope) => void): Unsubscribe {
			handlers.add(handler);
			return () => handlers.delete(handler);
		},
		close(): void {
			if (closed) return;
			closed = true;
			handlers.clear();
			listen.removeEventListener('message', onMessage);
		}
	};
}
