/**
 * EnvironmentClient: the Container-side facade over an EnvironmentTransport. It stamps
 * protocol version + sessionId, correlates request/response pairs by requestId and hides
 * iframe/MessagePort/postMessage details behind the transport adapter. The client never
 * talks about endpoints in envelopes — the endpoint role is fixed at construction by the
 * channel the adapter belongs to.
 */
import {
	createEnvironmentEnvelope,
	ENVIRONMENT_MESSAGE_NAMES,
	validateEnvironmentEnvelope,
	type EnvironmentEnvelope,
	type EnvironmentMessageName,
	type EnvironmentTransport
} from 'tool-contract';

export type { EnvironmentMessagePayload, EnvironmentMessageName } from 'tool-contract';

export type EnvironmentMessageHandler = (payload: unknown, requestId?: string) => void;
export type Unsubscribe = () => void;

export interface EnvironmentClientOptions {
	sessionId: string;
	endpoint: 'main' | 'slate';
	/** Default per-request timeout used when the caller does not provide one. */
	timeoutMs?: number;
	onInvalidMessage?: (reason: string) => void;
}

interface PendingRequest {
	resolve: (payload: unknown) => void;
	reject: (reason: Error) => void;
	timer: ReturnType<typeof setTimeout>;
}

export class EnvironmentClient {
	readonly sessionId: string;
	readonly endpoint: 'main' | 'slate';

	private readonly transport: EnvironmentTransport;
	private readonly timeoutMs: number;
	private readonly onInvalidMessage: (reason: string) => void;
	private readonly pending = new Map<string, PendingRequest>();
	private readonly handlers = new Map<EnvironmentMessageName, Set<EnvironmentMessageHandler>>();
	private unsubscribe: Unsubscribe;
	private sequence = 0;
	private disposed = false;

	constructor(transport: EnvironmentTransport, options: EnvironmentClientOptions) {
		this.transport = transport;
		this.sessionId = options.sessionId;
		this.endpoint = options.endpoint;
		this.timeoutMs = options.timeoutMs ?? 10_000;
		this.onInvalidMessage = options.onInvalidMessage ?? (() => {});
		this.unsubscribe = transport.subscribe((message) => this.handleIncoming(message));
	}

	/**
	 * Sends a request and resolves with the response payload once the peer answers with
	 * the matching requestId. Rejects on timeout (`environment-request-timeout`) or when
	 * the client is disposed.
	 */
	request(name: EnvironmentMessageName, payload: unknown, options?: { timeoutMs?: number }): Promise<unknown> {
		if (this.disposed) return Promise.reject(new Error('environment-client-disposed'));
		const requestId = `r-${++this.sequence}`;
		const timeoutMs = options?.timeoutMs ?? this.timeoutMs;
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(requestId);
				reject(new Error('environment-request-timeout'));
			}, timeoutMs);
			this.pending.set(requestId, { resolve, reject, timer });
			this.transport.send(
				createEnvironmentEnvelope({ sessionId: this.sessionId, kind: 'request', name, requestId, payload })
			);
		});
	}

	/** Answers a peer request: kind 'response' with the echoed requestId. */
	respond(requestId: string, name: EnvironmentMessageName, payload: unknown): void {
		if (this.disposed) return;
		this.transport.send(
			createEnvironmentEnvelope({ sessionId: this.sessionId, kind: 'response', name, requestId, payload })
		);
	}

	/** Sends a one-way event (e.g. `surface.ready`) — never carries a requestId. */
	emit(name: EnvironmentMessageName, payload: unknown): void {
		if (this.disposed) return;
		this.transport.send(createEnvironmentEnvelope({ sessionId: this.sessionId, kind: 'event', name, payload }));
	}

	/** Subscribes to Host-driven messages (requests and events) by name. */
	on(name: EnvironmentMessageName, handler: EnvironmentMessageHandler): Unsubscribe {
		let set = this.handlers.get(name);
		if (set === undefined) {
			set = new Set();
			this.handlers.set(name, set);
		}
		set.add(handler);
		return () => {
			set?.delete(handler);
		};
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.unsubscribe();
		this.handlers.clear();
		for (const pending of this.pending.values()) {
			clearTimeout(pending.timer);
			pending.reject(new Error('environment-client-disposed'));
		}
		this.pending.clear();
	}

	private handleIncoming(message: EnvironmentEnvelope): void {
		if (this.disposed) return;
		const validation = validateEnvironmentEnvelope(message);
		if (!validation.ok) {
			this.onInvalidMessage(validation.diagnostics.map((d) => d.code).join(','));
			return;
		}
		if (message.sessionId !== this.sessionId) {
			this.onInvalidMessage('session-mismatch');
			return;
		}
		if (message.kind === 'response') {
			const requestId = message.requestId;
			if (requestId === undefined) return;
			const pending = this.pending.get(requestId);
			if (pending === undefined) return;
			this.pending.delete(requestId);
			clearTimeout(pending.timer);
			pending.resolve(message.payload);
			return;
		}
		const handlers = this.handlers.get(message.name);
		if (handlers === undefined || handlers.size === 0) return;
		for (const handler of [...handlers]) {
			handler(message.payload, message.requestId);
		}
	}
}

export function isEnvironmentMessageName(name: string): name is EnvironmentMessageName {
	return name in ENVIRONMENT_MESSAGE_NAMES;
}