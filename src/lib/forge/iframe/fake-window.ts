/**
 * Fake window pair for iframe transport tests: mimics `postMessage` + `message` event
 * semantics of two same-origin frames (parent ↔ container) with deterministic or
 * browser-like async delivery. No real DOM involved.
 *
 * Semantics (mirroring the real DOM): `A.postMessage(m)` means "a message arrives AT
 * window A" — exactly what the peer's code does when it calls `A.postMessage(...)` from
 * outside. The event is enqueued in A's own queue with `source = A.linked` (the assumed
 * single peer) and delivered to A's listeners by `A.flush()` (manual) or on a microtask
 * when `autoFlush` is on. `deliverFrom(source, data, origin?)` injects arbitrary events
 * (foreign sources/origins) for rejection tests.
 */
import type { IncomingMessageEvent, MessageEventTarget, PostMessageTarget } from '../dom.js';

type Listener = (event: IncomingMessageEvent) => void;

export class FakeWindow implements MessageEventTarget, PostMessageTarget {
	readonly origin: string;
	private readonly listeners = new Set<Listener>();
	private queue: Array<IncomingMessageEvent> = [];
	/** Last known postMessage targetOrigin (asserted in tests). */
	lastTargetOrigin: string | null = null;
	/** When true, posted messages deliver themselves on a microtask (browser-like). */
	autoFlush = false;

	linked?: FakeWindow;

	constructor(origin = 'https://deshelf.test') {
		this.origin = origin;
	}

	addEventListener(type: 'message', listener: Listener): void {
		if (type !== 'message') return;
		this.listeners.add(listener);
	}

	removeEventListener(type: 'message', listener: Listener): void {
		if (type !== 'message') return;
		this.listeners.delete(listener);
	}

	postMessage(message: unknown, targetOrigin: string): void {
		this.lastTargetOrigin = targetOrigin;
		const event: IncomingMessageEvent = { source: this.linked ?? null, origin: this.linked?.origin ?? '', data: message };
		this.enqueue(event);
		if (this.autoFlush) queueMicrotask(() => this.flush());
	}

	/** Injects an arbitrary event (any source/origin) into this window's queue. */
	deliverFrom(source: unknown, data: unknown, origin = this.origin): void {
		this.enqueue({ source, origin, data });
	}

	/** Delivers every queued event synchronously (postMessage is async in browsers). */
	flush(): void {
		const pending = this.queue;
		this.queue = [];
		for (const event of pending) {
			for (const listener of [...this.listeners]) listener(event);
		}
	}

	get queuedCount(): number {
		return this.queue.length;
	}

	private enqueue(event: IncomingMessageEvent): void {
		this.queue.push(event);
	}
}

/** Two windows mutually linked like parent ↔ same-origin iframe. */
export function createFakeWindowPair(origin = 'https://deshelf.test'): { parent: FakeWindow; container: FakeWindow } {
	const parent = new FakeWindow(origin);
	const container = new FakeWindow(origin);
	parent.linked = container;
	container.linked = parent;
	return { parent, container };
}
