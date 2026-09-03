/**
 * Fakes for the Electron MessagePort surface used by the Desktop adapter tests:
 *
 * - `FakeMessageChannelMain` mirrors `MessageChannelMain` (two connected ports in the
 *   Main process);
 * - `transferToRenderer(port)` mirrors `webContents.postMessage(channel, null, [port])`:
 *   the main-process object is detached and the renderer receives an HTML-MessagePort
 *   view of the SAME logical port;
 * - after both ends are transferred, messages flow renderer↔renderer asynchronously
 *   (microtask), exactly like real Chromium port delivery — the Main process sees
 *   nothing, which is precisely the property the Desktop transport relies on.
 */

export type MessageListener = (event: { data: unknown }) => void;

class LogicalPort {
	closed = false;
	started = false;
	queue: Array<{ data: unknown }> = [];
	mainListeners = new Set<MessageListener>();
	rendererListeners = new Set<MessageListener>();
	peer: LogicalPort | undefined;
	/** Browser-like async delivery; tests can drain with a macrotask tick. */
	autoFlush = true;

	post(data: unknown): void {
		const peer = this.peer;
		if (peer === undefined || peer.closed) return;
		peer.queue.push({ data });
		if (!peer.started) return; // platform queues until start()
		this.scheduleFlush(peer);
	}

	private scheduled = false;
	private scheduleFlush(port: LogicalPort): void {
		if (this.scheduled || !port.autoFlush) return;
		this.scheduled = true;
		queueMicrotask(() => {
			this.scheduled = false;
			this.flush(port);
		});
	}

	flush(port: LogicalPort): void {
		const listeners = port.rendererListeners.size > 0 ? port.rendererListeners : port.mainListeners;
		while (port.queue.length > 0 && listeners.size > 0) {
			const event = port.queue.shift() as { data: unknown };
			for (const listener of [...listeners]) listener(event);
		}
	}

	/** A port that has been transferred out of the Main process is closed in Main. */
	detachFromMain(): void {
		this.mainListeners.clear();
	}
}

export class FakeMessagePortMain {
	readonly logical: LogicalPort;

	constructor(logical: LogicalPort) {
		this.logical = logical;
	}

	private readonly messageListeners = new Set<MessageListener>();

	on(event: 'message', listener: MessageListener): this {
		if (event === 'message') this.messageListeners.add(listener);
		return this;
	}

	off(event: 'message', listener: MessageListener): this {
		if (event === 'message') this.messageListeners.delete(listener);
		return this;
	}

	start(): void {
		this.logical.started = true;
		this.logical.mainListeners = this.messageListeners;
		this.logical.flush(this.logical);
	}

	close(): void {
		this.logical.closed = true;
		this.logical.mainListeners.clear();
		this.logical.rendererListeners.clear();
	}

	postMessage(message: unknown, _transfer?: unknown[]): void {
		this.logical.post(message);
	}

	get isClosed(): boolean {
		return this.logical.closed;
	}
}

export class FakeRendererPort {
	readonly logical: LogicalPort;

	constructor(logical: LogicalPort) {
		this.logical = logical;
	}

	private readonly listeners = new Set<MessageListener>();
	onmessage: MessageListener | null = null;

	postMessage(message: unknown): void {
		this.logical.post(message);
	}

	start(): void {
		this.logical.started = true;
		this.logical.rendererListeners = this.listeners;
		this.logical.flush(this.logical);
	}

	close(): void {
		this.logical.closed = true;
		this.logical.rendererListeners.clear();
	}

	addEventListener(type: 'message', listener: MessageListener): void {
		if (type === 'message') this.listeners.add(listener);
	}

	removeEventListener(type: 'message', listener: MessageListener): void {
		if (type === 'message') this.listeners.delete(listener);
	}
}

export class FakeMessageChannelMain {
	readonly port1: FakeMessagePortMain;
	readonly port2: FakeMessagePortMain;

	constructor() {
		const a = new LogicalPort();
		const b = new LogicalPort();
		a.peer = b;
		b.peer = a;
		this.port1 = new FakeMessagePortMain(a);
		this.port2 = new FakeMessagePortMain(b);
	}
}

/**
 * Mirrors transferring a Main-process port into a renderer via
 * `webContents.postMessage(channel, payload, [port])`: the renderer receives the same
 * logical port as an HTML MessagePort; the Main-process object is detached.
 */
export function transferToRenderer(port: FakeMessagePortMain): FakeRendererPort {
	port.logical.detachFromMain();
	return new FakeRendererPort(port.logical);
}

/** Drains browser-like async port delivery (and chained microtask work). */
export async function drainPorts(ticks = 4): Promise<void> {
	for (let i = 0; i < ticks; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}
