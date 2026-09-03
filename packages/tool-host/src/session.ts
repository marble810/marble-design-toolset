/**
 * Tool Session core: Catalog-driven lifecycle (Cataloged → HostReady → Booting → Ready |
 * Failed → Closed), Ready health (Responsive | Unresponsive), Environment API routing
 * with session filtering, Host-owned Parameter Store + retained Standard Inspector, Tool
 * Command lifecycle and staged Reload with the single-replacement invariant.
 *
 * The session never owns transports: the app creates containers (iframe / WebContents),
 * adopts their EnvironmentTransport ends and closes them. The session only subscribes,
 * sends envelopes and emits surface.dispose before replacement/close.
 *
 * Channel roles: endpoint role is determined by which channel a transport belongs to.
 * Compute responses, command results and export results are Main-only messages; Slate
 * channels sending them are dropped with a typed diagnostic. Slate boot is deferred
 * until Main is Ready (both for the active session and for staged Reload).
 */
import {
	createEnvironmentEnvelope,
	error,
	validateEnvironmentEnvelope,
	type AssetContent,
	type AssetSlotDescriptor,
	type AssetSnapshot,
	type BootSurface,
	type CatalogEntry,
	type Diagnostic,
	type EnvironmentEnvelope,
	type EnvironmentInventory,
	type EnvironmentTransport,
	type ExportContent,
	type InspectorBinding,
	type ParameterSnapshot,
	type ParameterSetResponsePayload,
	type ParameterValue
} from 'tool-contract';
import { ParameterStore, validateParameterValue, type ComputeExecutor, type ComputeOutcome, type ComputeRequest, type ParameterSetResult } from './parameter-store.ts';
import { ToolCommandRunner, type CommandActionResult, type CommandStatusEvent } from './command-runner.ts';
import { InspectorHost, type ActionStatusSource } from './inspector/inspector-host.ts';
import { resolveInspectorTree } from './inspector/default-tree.ts';
import { DiagnosticLog } from './diagnostics.ts';
import { resolveRuntimeConfig, type DeshelfRuntimeConfig } from './runtime-config.ts';
import type { Timer } from './timer.ts';
import { defaultTimer } from './timer.ts';

export type ToolSessionState = 'Cataloged' | 'HostReady' | 'Booting' | 'Ready' | 'Failed' | 'Closed';
export type ToolSessionHealth = 'Responsive' | 'Unresponsive';

export interface ToolSessionOptions {
	entry: CatalogEntry;
	runtimeConfig?: Partial<DeshelfRuntimeConfig>;
	timer?: Timer;
	/** Deterministic tests pin the session id; default is crypto.randomUUID(). */
	sessionId?: string;
	onStateChange?: (state: ToolSessionState) => void;
	onHealthChange?: (health: ToolSessionHealth) => void;
	onDiagnostic?: (diagnostic: Diagnostic) => void;
	/** Environment-supplied asset adapter (Web: blob URL; Desktop: opaque handle). */
	assetResolver?: (assetId: string) => AssetContent | null | Promise<AssetContent | null>;
}

export interface BootOptions {
	main: EnvironmentTransport;
	surface: BootSurface;
	inventory?: EnvironmentInventory;
}

export type ReloadResult = { ok: true; handle: ReloadHandle } | { ok: false; diagnostic: Diagnostic };

/** Typed diagnostic code for messages that are only valid on the Main channel. */
export const MAIN_ONLY_MESSAGE_CODE = 'session/main-only-message' as const;

type ComputePending = {
	resolve: (outcome: ComputeOutcome) => void;
	reject: (reason: Error) => void;
	cancel: () => void;
	/** Which store owns this correlation: the active session or the staged replacement. */
	owner: 'active' | 'staged';
};

type ExportPending = {
	resolve: (payload: { invocationId: string; ok: boolean; error?: Diagnostic; content?: ExportContent }) => void;
	reject: (reason: Error) => void;
	cancel: () => void;
};

export type ChannelRole = 'main' | 'slate';

/**
 * Shared boot envelope builder: the only place the Host-side protocol payload is
 * assembled, used by both the active session and staged replacements so the two
 * boot paths cannot drift.
 */
export function createBootEnvelope(options: {
	sessionId: string;
	endpoint: 'main' | 'slate';
	parameters: ParameterSnapshot;
	assets: AssetSnapshot;
	surface: BootSurface;
	inventory?: EnvironmentInventory;
}): EnvironmentEnvelope {
	return createEnvironmentEnvelope({
		sessionId: options.sessionId,
		kind: 'request',
		name: 'boot',
		requestId: `boot-${options.endpoint}`,
		payload: {
			endpoint: options.endpoint,
			parameters: options.parameters,
			assets: options.assets,
			surface: options.surface,
			inventory: options.inventory ?? { assets: [], exports: [] }
		}
	});
}

/**
 * Staged Asset migration: build the replacement boot snapshot from the NEW Entry's
 * declared slots only. A slot keeps its old content when it still exists and its
 * descriptor kind is unchanged; removed, re-typed or brand-new slots start empty.
 */
export function migrateAssetState(
	oldAssets: Readonly<Record<string, AssetSlotDescriptor>>,
	oldContents: Readonly<Record<string, AssetContent | null>>,
	newAssets: Readonly<Record<string, AssetSlotDescriptor>>
): Record<string, AssetContent | null> {
	const out: Record<string, AssetContent | null> = {};
	for (const assetId of Object.keys(newAssets)) {
		const newSlot = newAssets[assetId];
		const oldSlot = oldAssets[assetId];
		const oldContent = oldContents[assetId];
		if (oldSlot !== undefined && oldContent !== null && oldContent !== undefined && oldSlot.kind === newSlot.kind) {
			out[assetId] = oldContent;
		} else {
			out[assetId] = null;
		}
	}
	return out;
}

export class ToolSession {
	private readonly options: ToolSessionOptions;
	private readonly runtimeConfig: DeshelfRuntimeConfig;
	private readonly timer: Timer;
	private readonly diagnosticsLog = new DiagnosticLog();

	private state: ToolSessionState = 'Cataloged';
	private health: ToolSessionHealth = 'Responsive';
	sessionId: string;

	entry: CatalogEntry;
	store: ParameterStore;
	inspector: InspectorHost;
	private runner: ToolCommandRunner;

	private mainChannel?: EnvironmentTransport;
	private slateChannel?: EnvironmentTransport;
	private mainUnsubscribe?: () => void;
	private slateUnsubscribe?: () => void;
	private startupCancel?: () => void;
	private slateStartupCancel?: () => void;
	private storeUnsubscribe?: () => void;
	private slateReadyFlag = false;
	private droppedMessages = 0;
	private computeSeq = 0;
	private exportSeq = 0;
	private readonly computePending = new Map<string, ComputePending>();
	private readonly exportPending = new Map<string, ExportPending>();
	private readonly assetContents: Record<string, AssetContent | null> = {};
	/** Per-slot generations suppress resolver completions older than the latest selection. */
	private readonly assetGenerations: Record<string, number> = {};

	/** Active staged replacement; the single-replacement invariant lives here. */
	reload: ReloadHandle | null = null;
	/** Replacement channel/session bound for the staged compute executor. */
	reloadChannel?: EnvironmentTransport;
	reloadSessionId?: string;

	constructor(options: ToolSessionOptions) {
		this.options = options;
		this.runtimeConfig = resolveRuntimeConfig(options.runtimeConfig);
		this.timer = options.timer ?? defaultTimer;
		this.sessionId = options.sessionId ?? crypto.randomUUID();
		this.entry = options.entry;
		for (const assetId of Object.keys(this.entry.assets)) {
			this.assetContents[assetId] = null;
			this.assetGenerations[assetId] = 0;
		}

		this.store = this.createParameterStore((request) => this.runCompute(request));
		this.wireStore(this.store);
		this.runner = this.createRunner();
		this.inspector = this.createInspectorHost(this.entry, this.store, this.runner);
		this.transition('HostReady');
	}

	// ------------------------------------------------------------------ state

	getState(): ToolSessionState {
		return this.state;
	}

	getHealth(): ToolSessionHealth {
		return this.health;
	}

	isSlateReady(): boolean {
		return this.slateReadyFlag;
	}

	getDiagnostics(): readonly Diagnostic[] {
		return this.diagnosticsLog.list();
	}

	getDroppedMessages(): number {
		return this.droppedMessages;
	}

	hasActiveReload(): boolean {
		return this.reload !== null;
	}

	get assetSnapshot(): AssetSnapshot {
		return { values: { ...this.assetContents } };
	}

	// ------------------------------------------------------------------ lifecycle

	/** Sends `boot` to the Main Container with the current snapshot and enters Booting. */
	boot(options: BootOptions): void {
		if (this.state !== 'HostReady') {
			throw new Error(`session/boot-state: cannot boot from '${this.state}'`);
		}
		this.mainChannel = options.main;
		this.mainUnsubscribe = this.mainChannel.subscribe((envelope) => this.onEnvelope(envelope, 'main'));
		this.sendBoot(this.mainChannel, 'main', options.surface, options.inventory);
		// Waves deferred during HostReady (no compute channel yet) retry after boot.
		this.store.retryPendingComputed();
		this.transition('Booting');
		this.startupCancel = this.timer.schedule(() => this.failStartup(), this.runtimeConfig.startupTimeoutMs);
	}

	/**
	 * Boots the optional Slate Container. The Slate MUST NOT boot before the Main Canvas
	 * is Ready (architecture: Slate boots independently AFTER Main Ready and never blocks
	 * it), so a pre-Ready call is rejected explicitly; the Slate timeout only starts once
	 * the boot envelope is actually sent.
	 */
	bootSlate(options: { transport: EnvironmentTransport; surface: BootSurface }): void {
		if (this.state === 'Closed') throw new Error('session/closed');
		if (this.state !== 'Ready') {
			throw new Error(`session/slate-boot: Main must be Ready before Slate boot, got '${this.state}'`);
		}
		if (this.slateChannel !== undefined) throw new Error('session/slate-boot: slate already booted');
		this.slateReadyFlag = false;
		this.slateChannel = options.transport;
		const slateSessionId = this.sessionId;
		const slateChannel = this.slateChannel;
		this.slateUnsubscribe = slateChannel.subscribe((envelope) => this.onEnvelope(envelope, 'slate'));
		this.sendBoot(slateChannel, 'slate', options.surface);
		this.slateStartupCancel = this.timer.schedule(
			() => this.failSlateStartup(slateSessionId, slateChannel),
			this.runtimeConfig.startupTimeoutMs
		);
	}

	/**
	 * Restart Tool: no rebuild — a fresh Session ID, fresh Store (defaults) and new
	 * Containers over the adopted transports. Available from Ready (incl. Unresponsive)
	 * and Failed. The old runtime is fully torn down first: timers cancelled, Store
	 * closed and unsubscribed, Inspector/Runner disposed, pending compute/export
	 * operations rejected, and old channels receive a best-effort surface.dispose.
	 */
	restart(options: BootOptions): void {
		if (this.state !== 'Ready' && this.state !== 'Failed') {
			throw new Error(`session/restart-state: cannot restart from '${this.state}'`);
		}
		if (this.reload !== null) throw new Error('session/reload-in-progress');
		this.disposeChannels('session-restarted');
		// Unsubscribe + drop the old channel references (including the old Slate), then
		// tear down the runtime so nothing from the previous Session can leak.
		this.detachChannels();
		this.teardownRuntime({ disposeRunner: true, clearCompute: true, clearExports: true, reason: 'session-restarted' });

		this.sessionId = crypto.randomUUID();
		this.slateReadyFlag = false;
		this.store = this.createParameterStore((request) => this.runCompute(request));
		this.wireStore(this.store);
		this.runner = this.createRunner();
		this.inspector = this.createInspectorHost(this.entry, this.store, this.runner);
		this.health = 'Responsive';
		this.mainChannel = options.main;
		this.mainUnsubscribe = this.mainChannel.subscribe((envelope) => this.onEnvelope(envelope, 'main'));
		this.sendBoot(this.mainChannel, 'main', options.surface, options.inventory);
		this.store.retryPendingComputed();
		this.transition('Booting');
		this.startupCancel = this.timer.schedule(() => this.failStartup(), this.runtimeConfig.startupTimeoutMs);
	}

	/**
	 * Host chrome resize of one Surface: forwards a `surface.resize` event on the given
	 * channel only. The Surface size lives in the Container; pixels and rAF never cross
	 * the Environment API — this is a small control-plane notification.
	 */
	resizeSurface(role: ChannelRole, size: { width: number; height: number }): void {
		const channel = this.channelFor(role);
		if (channel === undefined || this.state === 'Closed') return;
		channel.send(
			createEnvironmentEnvelope({
				sessionId: this.sessionId,
				kind: 'event',
				name: 'surface.resize',
				payload: { width: size.width, height: size.height }
			})
		);
	}

	/** Reset Defaults: restores manual/overrideable defaults and recomputes; no Container change. */
	resetDefaults(): ParameterSetResult[] {
		if (this.state === 'Closed') return [];
		return this.store.resetDefaults();
	}

	close(): void {
		if (this.state === 'Closed') return;
		this.disposeChannels('session-closed');
		this.detachChannels();
		this.teardownRuntime({ disposeRunner: true, clearCompute: true, clearExports: true, reason: 'session-closed' });
		this.reload?.cancel();
		this.transition('Closed');
	}

	// ------------------------------------------------------------------ execution

	/**
	 * Host-launched public Tool Command. Only a Ready Session can execute commands: in
	 * HostReady/Booting/Failed/Closed the request is rejected with a typed diagnostic
	 * without creating an invocation, arming a timer or sending any envelope. The ID
	 * must be an own key of `entry.commands` — private-callback IDs and unknown IDs are
	 * rejected here and can only run through the Inspector binding path.
	 */
	executeCommand(commandId: string): CommandActionResult {
		if (this.state !== 'Ready') {
			return {
				ok: false,
				diagnostic: error('session/state', `commands require a Ready session, got '${this.state}'`, commandId)
			};
		}
		if (!Object.hasOwn(this.entry.commands, commandId)) {
			return {
				ok: false,
				diagnostic: error('command/unknown', `unknown command '${commandId}'`, commandId)
			};
		}
		return this.runner.execute(commandId);
	}

	/** Export through the Main artifact (`export.*` family); resolves on export.result. */
	executeExport(outputId: string): Promise<{ invocationId: string; ok: boolean; error?: Diagnostic; content?: ExportContent }> {
		if (this.state !== 'Ready' || this.mainChannel === undefined) {
			return Promise.reject(new Error(`session/state: export requires a Ready session, got '${this.state}'`));
		}
		if (!Object.hasOwn(this.entry.outputs, outputId)) {
			return Promise.reject(new Error(`export/unknown: unknown output '${outputId}'`));
		}
		const invocationId = `exp-${++this.exportSeq}`;
		return new Promise((resolve, reject) => {
			const cancel = this.timer.schedule(() => {
				this.exportPending.delete(invocationId);
				reject(new Error('export-timeout'));
			}, this.runtimeConfig.commandTimeoutMs);
			this.exportPending.set(invocationId, {
				resolve: (payload) => {
					cancel();
					resolve(payload);
				},
				reject: (reason) => {
					cancel();
					reject(reason);
				},
				cancel
			});
			this.mainChannel?.send(
				createEnvironmentEnvelope({
					sessionId: this.sessionId,
					kind: 'request',
					name: 'export.execute',
					requestId: `export-${invocationId}`,
					payload: { outputId, invocationId }
				})
			);
		});
	}

	/** Host asset picker result: stored and broadcast to Main + Slate. */
	setAsset(assetId: string, content: AssetContent | null): void {
		this.assetContents[assetId] = content;
		this.assetGenerations[assetId] = (this.assetGenerations[assetId] ?? 0) + 1;
		this.sendEvents('asset.changed', { assetId, content: content ?? { kind: 'empty' } });
	}

	// ------------------------------------------------------------------ envelope routing

	onEnvelope(envelope: EnvironmentEnvelope, role: ChannelRole): void {
		// Runtime validation FIRST: an invalid envelope is dropped with a typed
		// `env/invalid` diagnostic regardless of its session id (the id itself may be
		// malformed). Only valid envelopes proceed to stale-session filtering.
		const validation = validateEnvironmentEnvelope(envelope);
		if (!validation.ok) {
			this.droppedMessages += 1;
			this.addDiagnostic(error('env/invalid', `dropped invalid envelope: ${validation.diagnostics.map((d) => d.code).join(', ')}`));
			return;
		}
		// Old Session messages (Restart/Reload replaced the id) are dropped outright.
		if (envelope.sessionId !== this.sessionId) {
			this.droppedMessages += 1;
			return;
		}
		const payload = envelope.payload;
		switch (envelope.name) {
			case 'surface.ready': {
				const ready = payload as { endpoint: 'main' | 'slate'; surface: 'canvas' | 'slate' };
				if (role === 'main') {
					if (ready.endpoint !== 'main' || ready.surface !== 'canvas') {
						this.addDiagnostic(error('session/endpoint-mismatch', 'main channel reported a non-canvas ready'));
						return;
					}
					if (this.state === 'Booting') {
						this.startupCancel?.();
						this.startupCancel = undefined;
						this.transition('Ready');
						this.health = 'Responsive';
						// Ready 前 Store 可更新；ready 后补发最新 snapshot。
						this.sendCatchUpSnapshot(this.mainChannel);
					}
				} else {
					// No slate is currently booted (never booted, timed out terminal, or
					// detached): a late/duplicate ready must not revive the flag.
					if (this.slateChannel === undefined) return;
					if (ready.endpoint !== 'slate' || ready.surface !== 'slate') {
						this.addDiagnostic(error('session/endpoint-mismatch', 'slate channel reported a non-slate ready'));
						return;
					}
					this.slateReadyFlag = true;
					this.slateStartupCancel?.();
					this.slateStartupCancel = undefined;
				}
				return;
			}
			case 'parameter.set': {
				if (!this.acceptInboundKind(envelope, 'request')) return;
				const request = payload as { id: string; value: ParameterValue; expectedRevision: number };
				const result = this.store.set(request.id, request.value, request.expectedRevision);
				this.respond(role, envelope, result satisfies ParameterSetResponsePayload);
				return;
			}
			case 'parameter.compute': {
				if (!this.acceptInboundKind(envelope, 'response')) return;
				// Main-only: only the Main Container runs compute callbacks.
				if (role !== 'main') {
					this.dropMainOnlyMessage(envelope.name);
					return;
				}
				this.resolveComputeRequest(envelope.requestId, payload as ComputeOutcome);
				return;
			}
			case 'command.result': {
				// Main-only: commands execute in the Main artifact.
				if (role !== 'main') {
					this.dropMainOnlyMessage(envelope.name);
					return;
				}
				const result = payload as { invocationId: string; ok: boolean; error?: Diagnostic };
				if (result.error !== undefined) this.addDiagnostic(result.error);
				this.runner.onResult(result.invocationId, result.ok, result.error);
				return;
			}
			case 'asset.request': {
				if (!this.acceptInboundKind(envelope, 'request')) return;
				this.respondAssetRequest(role, envelope, (payload as { assetId: string }).assetId);
				return;
			}
			case 'export.result': {
				// Main-only: export render/encode runs in the Main artifact.
				if (role !== 'main') {
					this.dropMainOnlyMessage(envelope.name);
					return;
				}
				const result = payload as { invocationId: string; ok: boolean; error?: Diagnostic; content?: ExportContent };
				const pending = this.exportPending.get(result.invocationId);
				if (pending === undefined) return;
				this.exportPending.delete(result.invocationId);
				if (result.error !== undefined) this.addDiagnostic(result.error);
				pending.resolve(result);
				return;
			}
			case 'diagnostic.emit': {
				this.addDiagnostic((payload as { diagnostic: Diagnostic }).diagnostic);
				return;
			}
			default:
				// Host-driven messages received from a Container are dropped (wrong direction).
				this.droppedMessages += 1;
				return;
		}
	}

	// ------------------------------------------------------------------ internals

	private createParameterStore(compute: ComputeExecutor): ParameterStore {
		return new ParameterStore({
			descriptors: this.entry.parameters,
			compute,
			// Waves must never run (or be consumed) before a Main channel exists.
			canCompute: () => this.mainChannel !== undefined,
			runtimeConfig: this.runtimeConfig,
			timer: this.timer
		});
	}

	private createRunner(target?: {
		getSessionId: () => string;
		getMainChannel: () => EnvironmentTransport | undefined;
		onUnresponsive: () => void;
	}): ToolCommandRunner {
		const getSessionId = target?.getSessionId ?? (() => this.sessionId);
		const getMainChannel = target?.getMainChannel ?? (() => this.mainChannel);
		return new ToolCommandRunner({
			runtimeConfig: this.runtimeConfig,
			timer: this.timer,
			sendExecute: (invocationId, commandId) => {
				getMainChannel()?.send(
					createEnvironmentEnvelope({
						sessionId: getSessionId(),
						kind: 'request',
						name: 'command.execute',
						requestId: `cmd-${invocationId}`,
						payload: { commandId, invocationId }
					})
				);
			},
			sendCancel: (invocationId) => {
				getMainChannel()?.send(
					createEnvironmentEnvelope({
						sessionId: getSessionId(),
						kind: 'request',
						name: 'command.cancel',
						requestId: `cancel-${invocationId}`,
						payload: { invocationId }
					})
				);
			},
			onUnresponsive: target?.onUnresponsive ?? (() => this.markUnresponsive())
		});
	}

	/** Shared inspector construction: Catalog tree or default tree, never inline choices. */
	private createInspectorHost(entry: CatalogEntry, store: ParameterStore, runner: ToolCommandRunner): InspectorHost {
		return new InspectorHost({
			tree: resolveInspectorTree(entry),
			store,
			executeAction: (binding) => this.executeActionWithRunner(entry, runner, binding),
			commandStatus: { subscribe: (handler) => runner.subscribeStatus(handler) },
			onActionRejected: (diagnostic) => this.addDiagnostic(diagnostic)
		});
	}

	/**
	 * Full teardown of the current runtime ownership. Used by restart/close and reload
	 * commit; the flags decide which pending correlations transfer to replacement state.
	 * Order matters: unsubscribe + close + dispose first, then reject pending operations,
	 * so no stale diagnostic or event can reach the session or its UI after teardown.
	 */
	private teardownRuntime(options: { disposeRunner: boolean; clearCompute: boolean; clearExports: boolean; reason: string }): void {
		this.cancelTimers();
		this.storeUnsubscribe?.();
		this.storeUnsubscribe = undefined;
		this.store.close();
		if (options.disposeRunner) this.runner.dispose();
		this.inspector.dispose();
		if (options.clearExports) {
			this.rejectExportPending(options.reason);
		}
		if (options.clearCompute) {
			this.rejectComputePending(options.reason);
		}
	}

	private rejectExportPending(reason: string): void {
		for (const pending of this.exportPending.values()) {
			pending.cancel();
			pending.reject(new Error(reason));
		}
		this.exportPending.clear();
	}

	private rejectComputePending(reason: string): void {
		for (const pending of this.computePending.values()) {
			pending.cancel();
			pending.reject(new Error(reason));
		}
		this.computePending.clear();
	}

	/**
	 * Routes an Inspector button binding to the (active or staged) runner. A command
	 * binding must reference an own key of the bound entry's `commands` map; a
	 * private-callback binding must reference an own key of `privateCallbacks`. Unknown
	 * or mismatched bindings produce a typed rejection and never send a message.
	 * Actions are only executable while the Session is Ready.
	 */
	private executeActionWithRunner(entry: CatalogEntry, runner: ToolCommandRunner, binding: InspectorBinding): CommandActionResult {
		// A staged Inspector exists while the active Session is still Ready. Object identity
		// ensures only the currently committed entry/runner can execute actions.
		if (this.state !== 'Ready' || entry !== this.entry || runner !== this.runner) {
			return {
				ok: false,
				diagnostic: error('session/state', 'actions require the committed Ready session')
			};
		}
		if (binding.kind === 'command') {
			if (!Object.hasOwn(entry.commands, binding.commandId)) {
				return {
					ok: false,
					diagnostic: error('command/unknown', `unknown command '${binding.commandId}'`, binding.commandId)
				};
			}
			return runner.execute(binding.commandId);
		}
		if (binding.kind === 'private-callback') {
			if (!Object.hasOwn(entry.privateCallbacks, binding.callbackId)) {
				return {
					ok: false,
					diagnostic: error('private-callback/unknown', `unknown private callback '${binding.callbackId}'`, binding.callbackId)
				};
			}
			return runner.execute(binding.callbackId);
		}
		return { ok: false, diagnostic: error('inspector/binding', 'parameter bindings are not executable') };
	}

	private sendBoot(channel: EnvironmentTransport, endpoint: 'main' | 'slate', surface: BootSurface, inventory?: EnvironmentInventory): void {
		channel.send(
			createBootEnvelope({
				sessionId: this.sessionId,
				endpoint,
				parameters: this.store.snapshot(),
				assets: this.assetSnapshot,
				surface,
				inventory
			})
		);
	}

	private respond(role: ChannelRole, request: EnvironmentEnvelope, payload: ParameterSetResponsePayload): void {
		const channel = role === 'main' ? this.mainChannel : this.slateChannel;
		if (channel === undefined || request.requestId === undefined) return;
		channel.send(
			createEnvironmentEnvelope({ sessionId: this.sessionId, kind: 'response', name: 'parameter.set', requestId: request.requestId, payload })
		);
	}

	private respondAssetRequest(role: ChannelRole, request: EnvironmentEnvelope, assetId: string): void {
		const channel = this.channelFor(role);
		if (channel === undefined || request.requestId === undefined || this.state === 'Closed') return;
		// Bind the async resolver to the exact Session generation and transport. Restart,
		// Reload commit, close, or Slate timeout all invalidate this identity before an
		// awaited resolver is allowed to send its response.
		const sessionId = this.sessionId;
		const assetGeneration = this.assetGenerations[assetId] ?? 0;
		void this.resolveAsset(role, channel, sessionId, request.requestId, assetId, assetGeneration);
	}

	private async resolveAsset(
		role: ChannelRole,
		channel: EnvironmentTransport,
		sessionId: string,
		requestId: string,
		assetId: string,
		assetGeneration: number
	): Promise<void> {
		let content: AssetContent = this.assetContents[assetId] ?? { kind: 'empty' };
		try {
			const resolved = await this.options.assetResolver?.(assetId);
			if (resolved !== undefined && resolved !== null) content = resolved;
		} catch {
			// resolver failure keeps the current/empty content
		}
		if (
			this.state === 'Closed' ||
			this.sessionId !== sessionId ||
			this.channelFor(role) !== channel ||
			(this.assetGenerations[assetId] ?? 0) !== assetGeneration
		) return;
		channel.send(
			createEnvironmentEnvelope({
				sessionId,
				kind: 'response',
				name: 'asset.request',
				requestId,
				payload: { assetId, content }
			})
		);
	}

	private channelFor(role: ChannelRole): EnvironmentTransport | undefined {
		return role === 'main' ? this.mainChannel : this.slateChannel;
	}

	private sendEvents(name: 'parameter.changed' | 'asset.changed', payload: unknown): void {
		for (const channel of [this.mainChannel, this.slateChannel]) {
			channel?.send(createEnvironmentEnvelope({ sessionId: this.sessionId, kind: 'event', name, payload }));
		}
	}

	private sendCatchUpSnapshot(channel?: EnvironmentTransport): void {
		if (channel === undefined) return;
		channel.send(
			createEnvironmentEnvelope({
				sessionId: this.sessionId,
				kind: 'request',
				name: 'parameter.snapshot',
				requestId: `snapshot-${++this.computeSeq}`,
				payload: { snapshot: this.store.snapshot() }
			})
		);
	}

	private wireStore(store: ParameterStore): void {
		this.storeUnsubscribe?.();
		this.storeUnsubscribe = store.subscribe((event) => {
			if (event.type === 'changed') {
				this.sendEvents('parameter.changed', { id: event.id, value: event.value, revision: event.revision });
			} else {
				this.addDiagnostic(event.diagnostic);
			}
		});
	}

	private async runCompute(request: ComputeRequest): Promise<ComputeOutcome> {
		const channel = this.mainChannel;
		if (channel === undefined) {
			// HostReady phase (no container yet): defer the wave instead of consuming it.
			// The store keeps it dirty and retries after Main boot or on the next commit.
			return { values: {}, defer: true };
		}
		return this.wireComputeRequest(this.sessionId, () => channel, request, 'active');
	}

	private async runStagedCompute(request: ComputeRequest): Promise<ComputeOutcome> {
		// Pre-commit the staged executor uses the replacement channel; post-commit it must
		// use the promoted main channel, so fall back to the live main channel.
		const sessionId = this.reloadSessionId ?? this.sessionId;
		const channel = this.reloadChannel ?? this.mainChannel;
		if (channel === undefined) return { values: {}, defer: true };
		return this.wireComputeRequest(sessionId, () => channel, request, 'staged');
	}

	private wireComputeRequest(
		sessionId: string,
		channelGetter: () => EnvironmentTransport,
		request: ComputeRequest,
		owner: 'active' | 'staged'
	): Promise<ComputeOutcome> {
		return new Promise((resolve, reject) => {
			const channel = channelGetter();
			const requestId = `compute-${++this.computeSeq}`;
			const cancel = this.timer.schedule(() => {
				this.computePending.delete(requestId);
				reject(new Error('parameter/compute-timeout'));
			}, this.runtimeConfig.computeTimeoutMs);
			this.computePending.set(requestId, {
				resolve: (outcome) => {
					cancel();
					resolve(outcome);
				},
				reject: (reason) => {
					cancel();
					reject(reason);
				},
				cancel,
				owner
			});
			channel.send(
				createEnvironmentEnvelope({
					sessionId,
					kind: 'request',
					name: 'parameter.compute',
					requestId,
					payload: { ids: request.ids, dependencies: request.dependencies }
				})
			);
		});
	}

	/** Shared by the active session and the staged replacement (requestIds never collide). */
	resolveComputeRequest(requestId: string | undefined, outcome: ComputeOutcome): void {
		if (requestId === undefined) return;
		const pending = this.computePending.get(requestId);
		if (pending === undefined) return;
		this.computePending.delete(requestId);
		pending.resolve(outcome);
	}

	/** Timer access for staged replacements (startup timeout). */
	scheduleTimer(callback: () => void): () => void {
		return this.timer.schedule(callback, this.runtimeConfig.startupTimeoutMs);
	}

	/** @internal — counts drops recorded by the staged replacement router. */
	recordDroppedMessage(): void {
		this.droppedMessages += 1;
	}

	/** Enforces Host-side message direction after the shared union/schema validates. */
	acceptInboundKind(envelope: EnvironmentEnvelope, expected: EnvironmentEnvelope['kind']): boolean {
		if (envelope.kind === expected) return true;
		this.droppedMessages += 1;
		this.addDiagnostic(
			error('env/invalid', `'${envelope.name}' must arrive at the Host as ${expected}, got ${envelope.kind}`, envelope.name)
		);
		return false;
	}

	/** Rejects only the staged replacement's in-flight compute correlations (release path). */
	rejectStagedComputePending(reason: string): void {
		this.rejectComputePendingByOwner('staged', reason);
	}

	private rejectComputePendingByOwner(owner: 'active' | 'staged', reason: string): void {
		for (const [requestId, pending] of [...this.computePending]) {
			if (pending.owner === owner) {
				pending.cancel();
				pending.reject(new Error(reason));
				this.computePending.delete(requestId);
			}
		}
	}

	private dropMainOnlyMessage(name: string): void {
		this.droppedMessages += 1;
		this.addDiagnostic(error(MAIN_ONLY_MESSAGE_CODE, `'${name}' is main-only and was dropped from the slate channel`, name));
	}

	/** Installs the migrated asset state after a successful Reload commit. */
	private replaceAssetState(values: Record<string, AssetContent | null>): void {
		const affectedIds = new Set([...Object.keys(this.assetContents), ...Object.keys(values)]);
		for (const assetId of affectedIds) {
			this.assetGenerations[assetId] = (this.assetGenerations[assetId] ?? 0) + 1;
		}
		for (const key of Object.keys(this.assetContents)) delete this.assetContents[key];
		Object.assign(this.assetContents, values);
	}

	private markUnresponsive(): void {
		if (this.state !== 'Ready' || this.health !== 'Responsive') return;
		this.health = 'Unresponsive';
		this.options.onHealthChange?.(this.health);
	}

	private failStartup(): void {
		if (this.state !== 'Booting') return;
		this.addDiagnostic(error('session/startup-timeout', `Main did not become ready within ${this.runtimeConfig.startupTimeoutMs}ms`));
		this.transition('Failed');
		// Container is retained for diagnostics; Restart is available in Host chrome.
	}

	/**
	 * Terminal Slate startup timeout: this Slate generation can never become ready. The
	 * subscription and channel reference are dropped (a late `surface.ready` cannot
	 * revive it), a best-effort surface.dispose is sent, and the slate slot is freed so
	 * a fresh Slate can boot. Main readiness is unaffected.
	 */
	private failSlateStartup(sessionId: string, channel: EnvironmentTransport): void {
		if (this.state === 'Closed' || this.sessionId !== sessionId || this.slateChannel !== channel) return;
		this.slateStartupCancel = undefined;
		channel.send(
			createEnvironmentEnvelope({ sessionId, kind: 'event', name: 'surface.dispose', payload: { reason: 'slate-startup-timeout' } })
		);
		this.slateUnsubscribe?.();
		this.slateUnsubscribe = undefined;
		this.slateChannel = undefined;
		this.slateReadyFlag = false;
		this.addDiagnostic(error('session/slate-timeout', `Slate did not become ready within ${this.runtimeConfig.startupTimeoutMs}ms`));
	}

	private disposeChannels(reason: string): void {
		for (const channel of [this.mainChannel, this.slateChannel]) {
			channel?.send(createEnvironmentEnvelope({ sessionId: this.sessionId, kind: 'event', name: 'surface.dispose', payload: { reason } }));
		}
	}

	/**
	 * Unsubscribes the session's channel handlers and clears the channel references.
	 * Used by restart (fresh containers), close and reload commit so an old Slate/Main
	 * transport neither receives new-Session broadcasts nor blocks a fresh boot.
	 */
	private detachChannels(): void {
		this.mainUnsubscribe?.();
		this.mainUnsubscribe = undefined;
		this.slateUnsubscribe?.();
		this.slateUnsubscribe = undefined;
		this.mainChannel = undefined;
		this.slateChannel = undefined;
	}

	private cancelTimers(): void {
		this.startupCancel?.();
		this.startupCancel = undefined;
		this.slateStartupCancel?.();
		this.slateStartupCancel = undefined;
	}

	private transition(next: ToolSessionState): void {
		if (this.state === next) return;
		this.state = next;
		this.options.onStateChange?.(next);
	}

	addDiagnostic(diagnostic: Diagnostic): void {
		this.diagnosticsLog.push(diagnostic);
		this.options.onDiagnostic?.(diagnostic);
	}

	/**
	 * Starts a staged Reload: migrates compatible Parameter values and Asset content into
	 * a fresh staged Store/Asset state, then boots replacement Containers with the staged
	 * snapshot. Commit only happens when the replacement Canvas reports ready; any
	 * failure releases staged resources and keeps the old Session. At most one
	 * replacement at a time.
	 */
	reloadStart(newEntry: CatalogEntry): ReloadResult {
		if (this.state === 'Closed') {
			return { ok: false, diagnostic: error('session/closed', 'session is closed') };
		}
		if (this.state !== 'Ready' && this.state !== 'Failed') {
			return { ok: false, diagnostic: error('session/reload-state', `reload requires Ready or Failed, got '${this.state}'`) };
		}
		if (this.reload !== null) {
			return { ok: false, diagnostic: error('session/reload-in-progress', 'a replacement is already staged') };
		}

		const stagedStore = new ParameterStore({
			descriptors: newEntry.parameters,
			compute: (request) => this.runStagedCompute(request),
			// Gate waves on a staged Main channel (or the promoted one after commit).
			canCompute: () => (this.reloadChannel ?? this.mainChannel) !== undefined,
			runtimeConfig: this.runtimeConfig,
			timer: this.timer
		});
		migrateParameterValues(this.store, stagedStore);
		// The staged replacement owns its own CommandRunner: the staged Inspector binds
		// actions/status to it, and commit disposes the old runner (killing any in-flight
		// invocation timers) before promoting this one, so no stale command.cancel or
		// Unresponsive marking can leak from the previous Session into the replacement.
		const stagedRunner = this.createRunner({
			getSessionId: () => this.reloadSessionId ?? this.sessionId,
			getMainChannel: () => this.reloadChannel ?? this.mainChannel,
			onUnresponsive: () => this.markUnresponsive()
		});
		const stagedInspector = this.createInspectorHost(newEntry, stagedStore, stagedRunner);
		const stagedAssets = migrateAssetState(this.entry.assets, this.assetContents, newEntry.assets);
		const handle = new ReloadHandle(this, newEntry, stagedStore, stagedInspector, stagedAssets, stagedRunner);
		this.reload = handle;
		return { ok: true, handle };
	}

	/**
	 * Atomic commit of the staged replacement: dispose the old Containers, tear down the
	 * old runtime, swap entry/store/inspector/sessionId/assets, promote the replacement
	 * channels — re-subscribing the Session router to the replacement Main so all
	 * post-commit messages (command results, parameter.set, compute responses, exports,
	 * diagnostics) are processed — and only then boot the replacement Slate (deferred
	 * until Main Ready). Called by ReloadHandle when the replacement Canvas reports ready.
	 */
	commitReload(handle: ReloadHandle): void {
		if (this.reload !== handle || handle.disposed) return;
		handle.disposed = true;
		handle.clearStartupTimer();
		// The handle's own subscriptions on the replacement transports end here; the
		// session router takes over the promoted Main channel below.
		handle.detachTransports();

		this.disposeChannels('session-replaced');
		this.detachChannels();
		// disposeRunner: true — the old runner's in-flight command timers must never fire
		// stale cancels over the promoted channel or mark the replacement Unresponsive.
		this.teardownRuntime({ disposeRunner: true, clearCompute: false, clearExports: true, reason: 'session-replaced' });
		// The old Session's in-flight compute correlations are dead (old Main disposed);
		// staged ones stay alive and resolve over the promoted channel.
		this.rejectComputePendingByOwner('active', 'session-replaced');
		// Promote the staged runner: the committed Inspector already binds to it.
		this.runner = handle.stagedRunner;

		this.slateReadyFlag = false;
		this.entry = handle.newEntry;
		this.store = handle.stagedStore;
		this.inspector = handle.stagedInspector;
		this.sessionId = handle.sessionId;
		// Commit is only reachable through adoptMain, which always sets replacementMain.
		const promotedMain = handle.replacementMain;
		if (promotedMain === undefined) return;
		this.mainChannel = promotedMain;
		this.mainUnsubscribe = promotedMain.subscribe((envelope) => this.onEnvelope(envelope, 'main'));
		this.slateChannel = undefined;
		this.replaceAssetState(handle.stagedAssets);
		// The staged Store's events transfer from the handle to the Session router now:
		// exactly one broadcaster after commit, no duplicate `parameter.changed`.
		handle.detachStore();
		this.wireStore(this.store);
		this.health = 'Responsive';
		this.reload = null;
		this.reloadChannel = undefined;
		this.reloadSessionId = undefined;
		if (this.state !== 'Ready') this.transition('Ready');
		// The replacement Slate boots only after the promoted Main is Ready.
		const slatePlan = handle.slatePlan;
		if (slatePlan !== undefined) {
			this.bootSlate(slatePlan);
		}
		this.sendCatchUpSnapshot(this.mainChannel);
	}
}

/**
 * Staged Parameter migration: keep a value only when the new descriptor keeps the same
 * type and the value still satisfies the new constraint. Computed parameters are never
 * migrated — the Host recomputes them from migrated inputs.
 */
export function migrateParameterValues(oldStore: ParameterStore, newStore: ParameterStore): void {
	for (const id of Object.keys(newStore.allDescriptors())) {
		const newDescriptor = newStore.descriptor(id);
		if (newDescriptor === undefined || newDescriptor.mode === 'computed') continue;
		const oldValue = oldStore.get(id);
		if (oldValue === undefined) continue;
		const oldDescriptor = oldStore.descriptor(id);
		if (oldDescriptor === undefined || oldDescriptor.type !== newDescriptor.type) continue;
		if (validateParameterValue(newDescriptor, oldValue) !== undefined) continue;
		newStore.seed(id, oldValue);
	}
}

/**
 * Replacement Session: owns the staged Store/Inspector/Asset state and the replacement
 * channels. `adoptMain` boots the replacement with the staged snapshot; Canvas ready
 * triggers the atomic commit in ToolSession; startup timeout, cancel or failure releases
 * staged resources and keeps the old Session active. `adoptSlate` only records the
 * transport/surface plan — the actual Slate boot happens after the promoted Main is
 * Ready and reported `surface.ready`, so a not-yet-ready slate is never reported ready.
 */
export class ReloadHandle {
	readonly sessionId: string;
	readonly newEntry: CatalogEntry;
	readonly stagedStore: ParameterStore;
	readonly stagedInspector: InspectorHost;
	readonly stagedAssets: Record<string, AssetContent | null>;
	/** Command runner owned by the staged replacement; promoted at commit. */
	readonly stagedRunner: ToolCommandRunner;
	/** Slate transport/surface plan; boot is deferred until after commit + Main Ready. */
	slatePlan?: { transport: EnvironmentTransport; surface: BootSurface };
	replacementMain?: EnvironmentTransport;
	disposed = false;

	private readonly session: ToolSession;
	private readonly startupTimer: (callback: () => void) => () => void;
	private startupCancel?: () => void;
	private mainSubscription?: () => void;
	private slateSubscription?: () => void;
	/** Staged Store event wiring; committed or released exactly once. */
	private stagedStoreUnsubscribe?: () => void;

	constructor(
		session: ToolSession,
		newEntry: CatalogEntry,
		stagedStore: ParameterStore,
		stagedInspector: InspectorHost,
		stagedAssets: Record<string, AssetContent | null>,
		stagedRunner: ToolCommandRunner
	) {
		this.session = session;
		this.newEntry = newEntry;
		this.stagedStore = stagedStore;
		this.stagedInspector = stagedInspector;
		this.stagedAssets = stagedAssets;
		this.stagedRunner = stagedRunner;
		this.sessionId = crypto.randomUUID();
		session.reloadSessionId = this.sessionId;
		this.startupTimer = (callback) => session.scheduleTimer(callback);
		// The staged Store broadcasts while staging: accepted `parameter.set` commits
		// emit `parameter.changed` to the adopted replacement channels (never the active
		// old ones), and computed invalid/timeout diagnostics surface on the Session.
		// Migration seeds never emit events, so seeding before this subscription is safe.
		this.stagedStoreUnsubscribe = this.stagedStore.subscribe((event) => {
			if (event.type === 'changed') {
				this.broadcastStaged('parameter.changed', { id: event.id, value: event.value, revision: event.revision });
			} else {
				this.session.addDiagnostic(event.diagnostic);
			}
		});
	}

	adoptMain(options: BootOptions): void {
		if (this.disposed) throw new Error('session/reload-disposed');
		this.replacementMain = options.main;
		this.session.reloadChannel = options.main;
		this.mainSubscription = this.replacementMain.subscribe((envelope) => this.onEnvelope(envelope, 'main'));
		// Boot first — a compute request must never reach a container before its boot.
		this.sendBoot('main', options.surface, options.inventory);
		// Then recompute computed parameters (including leaves) from the migrated inputs.
		this.stagedStore.recomputeComputed();
		this.startupCancel = this.startupTimer(() => this.fail('startup-timeout'));
	}

	/**
	 * Records the Slate plan only: the replacement Slate MUST NOT boot before the
	 * promoted Main is Ready (it never blocks Main Ready). The subscription is safe
	 * because pre-boot messages carry the staged sessionId and are ignored.
	 */
	adoptSlate(options: { transport: EnvironmentTransport; surface: BootSurface }): void {
		if (this.disposed) throw new Error('session/reload-disposed');
		if (this.slatePlan !== undefined) throw new Error('session/reload-slate: slate plan already recorded');
		this.slatePlan = options;
		this.slateSubscription = options.transport.subscribe((envelope) => this.onEnvelope(envelope, 'slate'));
	}

	onEnvelope(envelope: EnvironmentEnvelope, role: ChannelRole): void {
		if (this.disposed) return;
		// Runtime validation first, same as the active session: an invalid staged
		// envelope is counted and recorded on the Session diagnostics — never silently
		// returned — before any session-id filtering.
		const validation = validateEnvironmentEnvelope(envelope);
		if (!validation.ok) {
			this.session.recordDroppedMessage();
			this.session.addDiagnostic(
				error('env/invalid', `dropped invalid staged envelope: ${validation.diagnostics.map((d) => d.code).join(', ')}`)
			);
			return;
		}
		if (envelope.sessionId !== this.sessionId) {
			this.session.recordDroppedMessage();
			return;
		}
		const payload = envelope.payload;
		switch (envelope.name) {
			case 'surface.ready': {
				const ready = payload as { endpoint: 'main' | 'slate'; surface: 'canvas' | 'slate' };
				if (role === 'main') {
					if (ready.endpoint !== 'main' || ready.surface !== 'canvas') {
						this.session.addDiagnostic(error('session/endpoint-mismatch', 'replacement main channel reported a non-canvas ready'));
						return;
					}
					this.session.commitReload(this);
					return;
				}
				if (ready.endpoint !== 'slate' || ready.surface !== 'slate') {
					this.session.addDiagnostic(error('session/endpoint-mismatch', 'replacement slate channel reported a non-slate ready'));
				}
				return;
			}
			case 'parameter.set': {
				if (!this.session.acceptInboundKind(envelope, 'request')) return;
				const request = payload as { id: string; value: ParameterValue; expectedRevision: number };
				const result = this.stagedStore.set(request.id, request.value, request.expectedRevision);
				const channel = role === 'main' ? this.replacementMain : this.slatePlan?.transport;
				if (channel !== undefined && envelope.requestId !== undefined) {
					channel.send(
						createEnvironmentEnvelope({
							sessionId: this.sessionId,
							kind: 'response',
							name: 'parameter.set',
							requestId: envelope.requestId,
							payload: result satisfies ParameterSetResponsePayload
						})
					);
				}
				return;
			}
			case 'parameter.compute': {
				if (!this.session.acceptInboundKind(envelope, 'response')) return;
				// Main-only: only the replacement Main runs compute callbacks.
				if (role !== 'main') {
					this.session.recordDroppedMessage();
					this.session.addDiagnostic(error(MAIN_ONLY_MESSAGE_CODE, `'${envelope.name}' is main-only and was dropped from the slate channel`, envelope.name));
					return;
				}
				this.session.resolveComputeRequest(envelope.requestId, payload as ComputeOutcome);
				return;
			}
			case 'asset.request': {
				if (!this.session.acceptInboundKind(envelope, 'request')) return;
				// The booting replacement reads assets from the migrated staged state only
				// (never the active map). The reply is synchronous from stagedAssets, so
				// cancel/fail/commit close no async window and cannot leak a stale response.
				const assetId = (payload as { assetId: string }).assetId;
				const channel = role === 'main' ? this.replacementMain : this.slatePlan?.transport;
				if (channel === undefined || envelope.requestId === undefined) return;
				const content = this.stagedAssets[assetId] ?? { kind: 'empty' };
				channel.send(
					createEnvironmentEnvelope({
						sessionId: this.sessionId,
						kind: 'response',
						name: 'asset.request',
						requestId: envelope.requestId,
						payload: { assetId, content }
					})
				);
				return;
			}
			case 'command.result':
			case 'export.result': {
				// Main-only, like the active session: commands/exports live in the Main
				// artifact. During staging nothing is pending for the staged session, so a
				// main-channel result is ignored; a slate-channel one is a typed drop.
				if (role !== 'main') {
					this.session.recordDroppedMessage();
					this.session.addDiagnostic(error(MAIN_ONLY_MESSAGE_CODE, `'${envelope.name}' is main-only and was dropped from the slate channel`, envelope.name));
				}
				return;
			}
			case 'diagnostic.emit': {
				this.session.addDiagnostic((payload as { diagnostic: Diagnostic }).diagnostic);
				return;
			}
			default:
				return;
		}
	}

	/** Explicit cancellation: releases staged resources, keeps the old Session. */
	cancel(): void {
		this.release('canceled');
	}

	/** Startup timeout / boot failure of the replacement. */
	fail(reason: string): void {
		this.release(reason);
	}

	clearStartupTimer(): void {
		this.startupCancel?.();
		this.startupCancel = undefined;
	}

	/**
	 * Removes this handle's subscriptions on the replacement transports. Ownership
	 * either transfers to the promoted Session (commit) or disappears (release).
	 */
	detachTransports(): void {
		this.mainSubscription?.();
		this.mainSubscription = undefined;
		this.slateSubscription?.();
		this.slateSubscription = undefined;
	}

	/**
	 * Removes the staged Store subscription. Call before commit (the Session router
	 * wires the store and must be the only broadcaster) and during release (no staged
	 * event may survive a failed/cancelled replacement).
	 */
	detachStore(): void {
		this.stagedStoreUnsubscribe?.();
		this.stagedStoreUnsubscribe = undefined;
	}

	/** Broadcasts a staged Session event to the adopted replacement channels only. */
	private broadcastStaged(name: 'parameter.changed', payload: unknown): void {
		const channels = [this.replacementMain, this.slatePlan?.transport];
		for (const channel of channels) {
			if (channel === undefined) continue;
			channel.send(createEnvironmentEnvelope({ sessionId: this.sessionId, kind: 'event', name, payload }));
		}
	}

	// ------------------------------------------------------------------ staged internals

	private sendBoot(endpoint: 'main' | 'slate', surface: BootSurface, inventory?: EnvironmentInventory): void {
		const channel = endpoint === 'main' ? this.replacementMain : this.slatePlan?.transport;
		if (channel === undefined) return;
		channel.send(
			createBootEnvelope({
				sessionId: this.sessionId,
				endpoint,
				parameters: this.stagedStore.snapshot(),
				assets: { values: this.stagedAssets },
				surface,
				inventory
			})
		);
	}

	private release(reason: string): void {
		if (this.disposed) return;
		this.disposed = true;
		this.clearStartupTimer();
		for (const channel of [this.replacementMain, this.slatePlan?.transport]) {
			channel?.send(
				createEnvironmentEnvelope({ sessionId: this.sessionId, kind: 'event', name: 'surface.dispose', payload: { reason: 'reload-failed' } })
			);
		}
		this.detachTransports();
		// Release the whole staged runtime: no subscription, Store, Inspector, runner or
		// in-flight compute correlation may survive a failed/cancelled replacement.
		this.detachStore();
		this.stagedStore.close();
		this.stagedInspector.dispose();
		this.stagedRunner.dispose();
		this.session.rejectStagedComputePending(reason);
		this.session.reload = null;
		this.session.reloadChannel = undefined;
		this.session.reloadSessionId = undefined;
		if (reason !== 'canceled') {
			this.session.addDiagnostic(error('session/reload-failed', `replacement failed: ${reason}`));
		}
	}
}