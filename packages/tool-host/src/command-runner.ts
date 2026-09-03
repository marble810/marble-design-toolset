/**
 * Tool Command lifecycle: single-flight invocation, Runtime Config timeout, cancel after
 * timeout and Unresponsive Session health when a callback ignores cancel. Public Tool
 * Commands and Inspector private callbacks share this mechanism (they share the stable
 * ID namespace, so `commandId` needs no namespace prefix).
 */
import { error, type Diagnostic } from 'tool-contract';
import type { DeshelfRuntimeConfig } from './runtime-config.ts';
import type { Timer } from './timer.ts';

export type CommandStatusKind = 'running' | 'completed' | 'failed' | 'canceled';

export interface CommandStatusEvent {
	commandId: string;
	invocationId: string;
	status: CommandStatusKind;
	error?: Diagnostic;
}

export type CommandActionResult = { ok: true; invocationId: string } | { ok: false; diagnostic: Diagnostic };

export type CommandStatusListener = (event: CommandStatusEvent) => void;

export interface CommandRunnerOptions {
	runtimeConfig: DeshelfRuntimeConfig;
	timer: Timer;
	/** Sends `command.execute` to the Main Container. */
	sendExecute: (invocationId: string, commandId: string) => void;
	/** Sends `command.cancel` to the Main Container. */
	sendCancel: (invocationId: string) => void;
	/** The callback ignored cancel: Session health becomes Unresponsive; Restart is the remedy. */
	onUnresponsive: () => void;
}

interface Invocation {
	commandId: string;
	invocationId: string;
	timeoutCancel: () => void;
	graceCancel: () => void;
	/**
	 * True once timeout + cancel grace elapsed: the callback ignored cancel. The
	 * invocation is permanently locked until the runner is disposed (Restart): a late
	 * `command.result` must NOT unlock it, emit a terminal status or re-enable the
	 * control, because Session health is already Unresponsive.
	 */
	locked: boolean;
}

export class ToolCommandRunner {
	private readonly options: CommandRunnerOptions;
	private readonly active = new Map<string, Invocation>();
	private readonly live = new Map<string, string>(); // commandId → invocationId (single-flight)
	private readonly statusListeners = new Set<CommandStatusListener>();
	private sequence = 0;
	private disposed = false;

	constructor(options: CommandRunnerOptions) {
		this.options = options;
	}

	execute(commandId: string): CommandActionResult {
		if (this.disposed) {
			return { ok: false, diagnostic: error('command/closed', 'command runner is closed', commandId) };
		}
		if (this.live.has(commandId)) {
			return {
				ok: false,
				diagnostic: error('command/single-flight', `'${commandId}' is already running`, commandId)
			};
		}
		const invocationId = `inv-${++this.sequence}`;
		const invocation: Invocation = {
			commandId,
			invocationId,
			timeoutCancel: () => {},
			graceCancel: () => {},
			locked: false
		};
		this.active.set(invocationId, invocation);
		this.live.set(commandId, invocationId);

		invocation.timeoutCancel = this.options.timer.schedule(() => this.onTimeout(invocation), this.options.runtimeConfig.commandTimeoutMs);
		this.options.sendExecute(invocationId, commandId);
		this.emitStatus({ commandId, invocationId, status: 'running' });
		return { ok: true, invocationId };
	}

	/**
	 * Container-reported outcome (`command.result` event). Unknown invocations are
	 * ignored. A locked invocation (cancel-grace already expired, Session health is
	 * Unresponsive) stays locked: the result is dropped without emitting a terminal
	 * status, so the single-flight slot and the bound controls remain unavailable
	 * until the runner is disposed (Restart Tool).
	 */
	onResult(invocationId: string, ok: boolean, diagnostic?: Diagnostic): void {
		const invocation = this.active.get(invocationId);
		if (invocation === undefined || invocation.locked) return;
		invocation.timeoutCancel();
		invocation.graceCancel();
		this.active.delete(invocationId);
		this.live.delete(invocation.commandId);
		this.emitStatus({
			commandId: invocation.commandId,
			invocationId,
			status: ok ? 'completed' : 'failed',
			...(diagnostic !== undefined ? { error: diagnostic } : {})
		});
	}

	hasActive(commandId: string): boolean {
		return this.live.has(commandId);
	}

	/** Multiple consumers (Inspector hosts, Host chrome) subscribe to status changes. */
	subscribeStatus(listener: CommandStatusListener): () => void {
		this.statusListeners.add(listener);
		return () => this.statusListeners.delete(listener);
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		for (const invocation of this.active.values()) {
			invocation.timeoutCancel();
			invocation.graceCancel();
		}
		this.active.clear();
		this.live.clear();
		this.statusListeners.clear();
	}

	private onTimeout(invocation: Invocation): void {
		if (!this.active.has(invocation.invocationId)) return;
		this.options.sendCancel(invocation.invocationId);
		invocation.graceCancel = this.options.timer.schedule(() => {
			if (!this.active.has(invocation.invocationId)) return;
			// The callback ignored cancel: lock the invocation so a late result can never
			// unlock it, then report the terminal 'canceled' state and the Unresponsive
			// health. The invocation stays in `active`/`live` until runner disposal.
			invocation.locked = true;
			this.emitStatus({ commandId: invocation.commandId, invocationId: invocation.invocationId, status: 'canceled' });
			this.options.onUnresponsive();
		}, this.options.runtimeConfig.cancelGraceMs);
	}

	private emitStatus(event: CommandStatusEvent): void {
		for (const listener of [...this.statusListeners]) {
			listener(event);
		}
	}
}