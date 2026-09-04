/**
 * Fakes for the WebContents surface used by realm lifecycle tests.
 * Mirrors the structural contract of Electron WebContents the realm manager relies on.
 */
import type { ContainerWebContents, RealmBounds } from '../../src/main/realms.ts';

export class FakeWebContents implements ContainerWebContents {
	readonly webPreferences: Record<string, unknown>;
	url = '';
	destroyed = false;
	postedMessages: Array<{ channel: string; message: unknown; transfer?: unknown[] }> = [];
	executedScripts: string[] = [];
	bounds: RealmBounds | undefined;
	events: string[] = [];
	private readonly destroyedListeners = new Set<() => void>();

	constructor(webPreferences: Record<string, unknown>) {
		this.webPreferences = webPreferences;
	}

	async loadURL(url: string): Promise<void> {
		if (this.destroyed) throw new Error('web contents destroyed');
		this.url = url;
		this.events.push('load');
	}

	postMessage(channel: string, message?: unknown, transfer?: unknown[]): void {
		if (this.destroyed) throw new Error('web contents destroyed');
		this.postedMessages.push({ channel, message, transfer });
		this.events.push('postMessage');
	}

	isDestroyed(): boolean {
		return this.destroyed;
	}

	destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		for (const listener of [...this.destroyedListeners]) listener();
	}

	on(event: 'destroyed', listener: () => void): unknown {
		if (event === 'destroyed') this.destroyedListeners.add(listener);
		return this;
	}

	async executeJavaScript(code: string): Promise<unknown> {
		if (this.destroyed) throw new Error('web contents destroyed');
		this.executedScripts.push(code);
		return null;
	}

	getURL(): string {
		return this.url;
	}

	setBounds(bounds: RealmBounds): void {
		this.bounds = { ...bounds };
	}

	/** Test hook: simulate an external (crash) destroy. */
	simulateExternalDestroy(): void {
		this.destroyed = true;
		for (const listener of [...this.destroyedListeners]) listener();
	}
}

export class FakeMessageChannelFactory {
	channels: Array<{ port1: FakeRealmPort; port2: FakeRealmPort }> = [];

	create(): { port1: FakeRealmPort; port2: FakeRealmPort } {
		const pair = { port1: new FakeRealmPort(), port2: new FakeRealmPort() };
		pair.port1.peer = pair.port2;
		pair.port2.peer = pair.port1;
		this.channels.push(pair);
		return pair;
	}

	get closedPortCount(): number {
		return this.channels.reduce((count, pair) => count + (pair.port1.closed ? 1 : 0) + (pair.port2.closed ? 1 : 0), 0);
	}
}

export class FakeRealmPort {
	peer: FakeRealmPort | undefined;
	closed = false;
	started = false;
	messages: unknown[] = [];

	postMessage(message: unknown, _transfer?: unknown[]): void {
		if (this.closed) return;
		this.peer?.messages.push(message);
	}

	start(): void {
		this.started = true;
	}

	close(): void {
		this.closed = true;
	}
}
