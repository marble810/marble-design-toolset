/**
 * Structural DOM abstractions for the iframe Environment API transports. The transports
 * are written against these minimal interfaces so the message logic runs in bun unit
 * tests (fake windows) while the browser adapters pass the real window/iframe objects.
 *
 * Both transports filter strictly: the Host only accepts messages whose `source` is its
 * own iframe's contentWindow and whose `origin` equals the shared same-origin; the
 * Container only accepts messages from `window.parent` with the same origin. This is
 * session hygiene (multiple iframes/tabs), NOT a security boundary — same-origin Tool
 * Containers run in the Host renderer with full DOM access by design.
 */

/** Minimal `Window.postMessage` surface used by the transports. */
export interface PostMessageTarget {
	postMessage(message: unknown, targetOrigin: string): void;
}

/** Minimal subset of `MessageEvent` read by the transports. */
export interface IncomingMessageEvent {
	readonly source: unknown;
	readonly origin: string;
	readonly data: unknown;
}

/** Minimal `window.addEventListener('message', …)` surface. */
export interface MessageEventTarget {
	addEventListener(type: 'message', listener: (event: IncomingMessageEvent) => void): void;
	removeEventListener(type: 'message', listener: (event: IncomingMessageEvent) => void): void;
}

/** Minimal iframe `load` event surface (the real HTMLIFrameElement satisfies this). */
export interface LoadEventTarget {
	addEventListener(type: 'load', listener: () => void): void;
	removeEventListener(type: 'load', listener: () => void): void;
}

/** Structural view of an HTMLIFrameElement used by the Host transport. */
export interface IframeLike extends LoadEventTarget {
	contentWindow: PostMessageTarget | null;
}
