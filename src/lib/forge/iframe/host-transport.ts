/**
 * Host-side end of the same-origin iframe transport. Implements the shared
 * `EnvironmentTransport` seam on top of `postMessage`:
 *
 * - outbound envelopes are queued until the container document fired `load` (setting
 *   `src` before DOM insertion keeps this to exactly one load event), then flushed in
 *   order — no `hello`/`welcome` protocol stage is added for this;
 * - inbound envelopes are accepted only when `event.source === iframe.contentWindow`
 *   and `event.origin === origin`, so concurrent Tool iframes never see each other's
 *   traffic;
 * - `close()` stops delivery and drops the queue (the adapter tears the iframe down
 *   right after).
 *
 * This is transport plumbing, not a security boundary: same-origin Tool Containers run
 * in the Host renderer process. A looping tool can freeze the page — failure isolation
 * is explicitly NOT promised: a looping Tool can freeze the Host page.
 */
import type { EnvironmentEnvelope, EnvironmentTransport, Unsubscribe } from 'tool-contract';
import type { IframeLike, MessageEventTarget, PostMessageTarget } from './dom.js';

export interface IframeHostTransportOptions {
	/** The container iframe (must have `src` set before DOM insertion). */
	iframe: IframeLike;
	/** The Host window that observes inbound `message` events. */
	listen: MessageEventTarget;
	/** The shared same-origin (usually `window.location.origin`). */
	origin: string;
	/** Called when a message arrives from an unexpected source/origin. */
	onRejectedMessage?: (reason: string) => void;
}

export interface IframeHostTransport extends EnvironmentTransport {
	/** Resolves once the container document is loaded and queued envelopes flush. */
	whenLoaded: Promise<void>;
	/** Whether the container document has loaded (queued messages flush after this). */
	isLoaded(): boolean;
}

export function createIframeHostTransport(options: IframeHostTransportOptions): IframeHostTransport {
	const { iframe, listen, origin } = options;

	let loaded = false;
	let closed = false;
	let flushQueued = false;
	const outbound: EnvironmentEnvelope[] = [];
	const handlers = new Set<(message: EnvironmentEnvelope) => void>();
	let resolveLoaded!: () => void;
	const whenLoaded = new Promise<void>((resolve) => {
		resolveLoaded = resolve;
	});

	const onLoad = (): void => {
		loaded = true;
		resolveLoaded();
		flush();
	};
	// Inbound listening starts immediately (a container document could technically post
	// before the load event fires); outbound envelopes still wait for `load`.
	listen.addEventListener('message', onMessage);
	iframe.addEventListener('load', onLoad);

	function flush(): void {
		if (flushQueued || closed || !loaded) return;
		flushQueued = true;
		// Deliver on a microtask so senders never depend on synchronous container state.
		queueMicrotask(() => {
			flushQueued = false;
			if (closed || !loaded) return;
			const target: PostMessageTarget | null = iframe.contentWindow;
			if (target === null) return;
			while (outbound.length > 0) {
				const message = outbound.shift() as EnvironmentEnvelope;
				target.postMessage(message, origin);
			}
		});
	}

	function onMessage(event: IncomingMessageEvent): void {
		if (closed) return;
		const source = event.source as PostMessageTarget | null;
		if (source === null || source !== iframe.contentWindow) {
			options.onRejectedMessage?.('message source is not this container iframe');
			return;
		}
		if (event.origin !== origin) {
			options.onRejectedMessage?.(`message origin '${event.origin}' is not '${origin}'`);
			return;
		}
		for (const handler of [...handlers]) handler(event.data as EnvironmentEnvelope);
	}

	return {
		whenLoaded,
		isLoaded: () => loaded,
		send(message: EnvironmentEnvelope): void {
			if (closed) return;
			if (!loaded) {
				outbound.push(message);
				return;
			}
			const target = iframe.contentWindow;
			if (target === null) return;
			target.postMessage(message, origin);
		},
		subscribe(handler: (message: EnvironmentEnvelope) => void): Unsubscribe {
			handlers.add(handler);
			return () => handlers.delete(handler);
		},
		close(): void {
			if (closed) return;
			closed = true;
			outbound.length = 0;
			handlers.clear();
			listen.removeEventListener('message', onMessage);
			iframe.removeEventListener('load', onLoad);
		}
	};
}
