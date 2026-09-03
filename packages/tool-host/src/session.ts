/**
 * Tool Session core: Catalog-driven lifecycle (Cataloged → HostReady → Booting → Ready |
 * Failed → Closed), Ready health (Responsive | Unresponsive), Environment API routing
 * with session filtering, Host-owned Parameter Store + retained Standard Inspector, Tool
 * Command lifecycle and staged Reload with the single-replacement invariant.
 *
 * The session never owns transports: the app creates containers (iframe / WebContents),
 * adopts their EnvironmentTransport ends and closes them. The session only subscribes,
 * sends envelopes and emits surface.dispose before replacement/close.
 */
import {
	createEnvironmentEnvelope,
	error,
	validateEnvironmentEnvelope,
	type AssetContent,
	type AssetSnapshot,
	type BootSurface,
	type CatalogEntry,
	type Diagnostic,
	type EnvironmentEnvelope,
	type EnvironmentInventory,
	type EnvironmentTransport,
	type InspectorBinding,
	type ParameterSetResponsePayload,
	type ParameterValue
} from 'tool-contract';
import { ParameterStore, validateParameterValue, type ComputeOutcome, type ComputeRequest, type ParameterSetResult } from './parameter-store.ts';
import { ToolCommandRunner, type CommandActionResult, type CommandStatusEvent } from './command-runner.ts';
import { InspectorHost, type ActionStatusSource } from './inspector/inspector-host.ts';
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

type ComputePending = {
	resolve: (outcome: ComputeOutcome) => void;
	reject: (reason: Error) => void;
	cancel: () => void;
};

type ExportPending = {
	resolve: (payload: { invocationId: string; ok: boolean; error?: Diagnostic }) => void;
	reject: (reason: Error) => void;
	cancel: () => void;
};

export type ChannelRole = 'main' | 'slate';

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
		}

		this.store = new ParameterStore({
			descriptors: this.entry.parameters,
			compute: (request) => this.runCompute(request),
			runtimeConfig: this.runtimeConfig,
			timer: this.timer
		});
		this.wireStore(this.store);
		this.runner = this.createRunner();
		this.inspector = new InspectorHost({
			tree: this.entry.inspectorTree,
			store: this.store,
			executeAction: (binding) => this.executeAction(binding),
			commandStatus: { subscribe: (handler) => this.runner.subscribeStatus(handler) },
			onActionRejected: (diagnostic) => this.addDiagnostic(diagnostic)
		});
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
		this.mainChannel.subscribe((envelope) => this.onEnvelope(envelope, 'main'));
		this.sendBoot(this.mainChannel, 'main', options.surface, options.inventory);
		this.transition('Booting');
		this.startupCancel = this.timer.schedule(() => this.failStartup(), this.runtimeConfig.startupTimeoutMs);
	}

	/** Boots the optional Slate Container; readiness never blocks Main Ready. */
	bootSlate(options: { transport: EnvironmentTransport; surface: BootSurface }): void {
		if (this.state === 'Closed') throw new Error('session/closed');
		this.slateChannel = options.transport;
		this.slateChannel.subscribe((envelope) => this.onEnvelope(envelope, 'slate'));
		this.sendBoot(this.slateChannel, 'slate', options.surface);
		this.slateStartupCancel = this.timer.schedule(
			() => this.addDiagnostic(error('session/slate-timeout', 'Slate did not become ready')),
			this.runtimeConfig.startupTimeoutMs
		);
	}

	/**
	 * Restart Tool: no rebuild — a fresh Session ID, fresh Store (defaults) and new
	 * Containers over the adopted transports. Available from Ready (incl. Unresponsive)
	 * and Failed; the old transports receive a best-effort surface.dispose.
	 */
	restart(options: BootOptions): void {
		if (this.state !== 'Ready' && this.state !== 'Failed') {
			throw new Error(`session/restart-state: cannot restart from '${this.state}'`);
		}
		if (this.reload !== null) throw new Error('session/reload-in-progress');
		this.disposeChannels('session-restarted');

		this.sessionId = crypto.randomUUID();
		this.store = new ParameterStore({
			descriptors: this.entry.parameters,
			compute: (request) => this.runCompute(request),
			runtimeConfig: this.runtimeConfig,
			timer: this.timer
		});
		this.wireStore(this.store);
		this.runner = this.createRunner();
		this.inspector = new InspectorHost({
			tree: this.entry.inspectorTree,
			store: this.store,
			executeAction: (binding) => this.executeAction(binding),
			commandStatus: { subscribe: (handler) => this.runner.subscribeStatus(handler) },
			onActionRejected: (diagnostic) => this.addDiagnostic(diagnostic)
		});
		this.health = 'Responsive';
		this.mainChannel = options.main;
		this.mainChannel.subscribe((envelope) => this.onEnvelope(envelope, 'main'));
		this.sendBoot(this.mainChannel, 'main', options.surface, options.inventory);
		this.transition('Booting');
		this.startupCancel = this.timer.schedule(() => this.failStartup(), this.runtimeConfig.startupTimeoutMs);
	}

	/** Reset Defaults: restores manual/overrideable defaults and recomputes; no Container change. */
	resetDefaults(): ParameterSetResult[] {
		if (this.state === 'Closed') return [];
		return this.store.resetDefaults();
	}

	close(): void {
		if (this.state === 'Closed') return;
		this.disposeChannels('session-closed');
		this.cancelTimers();
		this.store.close();
		this.runner.dispose();
		for (const pending of this.exportPending.values()) {
			pending.cancel();
			pending.reject(new Error('session-closed'));
		}
		this.exportPending.clear();
		this.reload?.cancel();
		this.transition('Closed');
	}

	// ------------------------------------------------------------------ execution

	/** Host-launched Tool Command (also used by Inspector buttons via executeAction). */
	executeCommand(commandId: string): CommandActionResult {
		return this.runner.execute(commandId);
	}

	/** Export through the Main artifact (`export.*` family); resolves on export.result. */
	executeExport(outputId: string): Promise<{ invocationId: string; ok: boolean; error?: Diagnostic }> {
		if (this.state !== 'Ready' || this.mainChannel === undefined) {
			return Promise.reject(new Error(`session/state: export requires a Ready session, got '${this.state}'`));
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
		this.sendEvents('asset.changed', { assetId, content: content ?? { kind: 'empty' } });
	}

	// ------------------------------------------------------------------ envelope routing

	onEnvelope(envelope: EnvironmentEnvelope, role: ChannelRole): void {
		// Old Session messages (Restart/Reload replaced the id) are dropped outright.
		if (envelope.sessionId !== this.sessionId) {
			this.droppedMessages += 1;
			return;
		}
		const validation = validateEnvironmentEnvelope(envelope);
		if (!validation.ok) {
			this.droppedMessages += 1;
			this.addDiagnostic(error('env/invalid', `dropped invalid envelope: ${validation.diagnostics.map((d) => d.code).join(', ')}`));
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
				const request = payload as { id: string; value: ParameterValue; expectedRevision: number };
				const result = this.store.set(request.id, request.value, request.expectedRevision);
				this.respond(role, envelope, result satisfies ParameterSetResponsePayload);
				return;
			}
			case 'parameter.compute': {
				this.resolveComputeRequest(envelope.requestId, payload as ComputeOutcome);
				return;
			}
			case 'command.result': {
				const result = payload as { invocationId: string; ok: boolean; error?: Diagnostic };
				if (result.error !== undefined) this.addDiagnostic(result.error);
				this.runner.onResult(result.invocationId, result.ok, result.error);
				return;
			}
			case 'asset.request': {
				this.respondAssetRequest(role, envelope, (payload as { assetId: string }).assetId);
				return;
			}
			case 'export.result': {
				const result = payload as { invocationId: string; ok: boolean; error?: Diagnostic };
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

	private createRunner(): ToolCommandRunner {
		return new ToolCommandRunner({
			runtimeConfig: this.runtimeConfig,
			timer: this.timer,
			sendExecute: (invocationId, commandId) => {
				this.mainChannel?.send(
					createEnvironmentEnvelope({
						sessionId: this.sessionId,
						kind: 'request',
						name: 'command.execute',
						requestId: `cmd-${invocationId}`,
						payload: { commandId, invocationId }
					})
				);
			},
			sendCancel: (invocationId) => {
				this.mainChannel?.send(
					createEnvironmentEnvelope({
						sessionId: this.sessionId,
						kind: 'request',
						name: 'command.cancel',
						requestId: `cancel-${invocationId}`,
						payload: { invocationId }
					})
				);
			},
			onUnresponsive: () => this.markUnresponsive()
		});
	}

	private executeAction(binding: InspectorBinding): CommandActionResult {
		if (binding.kind === 'command') return this.runner.execute(binding.commandId);
		if (binding.kind === 'private-callback') return this.runner.execute(binding.callbackId);
		return { ok: false, diagnostic: error('inspector/binding', 'parameter bindings are not executable') };
	}

	private sendBoot(channel: EnvironmentTransport, endpoint: 'main' | 'slate', surface: BootSurface, inventory?: EnvironmentInventory): void {
		channel.send(
			createEnvironmentEnvelope({
				sessionId: this.sessionId,
				kind: 'request',
				name: 'boot',
				requestId: `boot-${endpoint}`,
				payload: {
					endpoint,
					parameters: this.store.snapshot(),
					assets: this.assetSnapshot,
					surface,
					inventory: inventory ?? { assets: [], exports: [] }
				}
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
		const channel = role === 'main' ? this.mainChannel : this.slateChannel;
		if (channel === undefined || request.requestId === undefined || this.state === 'Closed') return;
		void this.resolveAsset(channel, request.requestId, assetId);
	}

	private async resolveAsset(channel: EnvironmentTransport, requestId: string, assetId: string): Promise<void> {
		let content: AssetContent = this.assetContents[assetId] ?? { kind: 'empty' };
		try {
			const resolved = await this.options.assetResolver?.(assetId);
			if (resolved !== undefined && resolved !== null) content = resolved;
		} catch {
			// resolver failure keeps the current/empty content
		}
		if (this.state === 'Closed') return;
		channel.send(
			createEnvironmentEnvelope({
				sessionId: this.sessionId,
				kind: 'response',
				name: 'asset.request',
				requestId,
				payload: { assetId, content }
			})
		);
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
		// Pre-boot commits keep the wave dirty; it is retried once a channel exists.
		if (channel === undefined) return { values: {} };
		return this.wireComputeRequest(this.sessionId, () => channel, request);
	}

	private async runStagedCompute(request: ComputeRequest): Promise<ComputeOutcome> {
		// Pre-commit the staged executor uses the replacement channel; post-commit it must
		// use the promoted main channel, so fall back to the live main channel.
		const sessionId = this.reloadSessionId ?? this.sessionId;
		const channel = this.reloadChannel ?? this.mainChannel;
		if (channel === undefined) return { values: {} };
		return this.wireComputeRequest(sessionId, () => channel, request);
	}

	private wireComputeRequest(sessionId: string, channelGetter: () => EnvironmentTransport, request: ComputeRequest): Promise<ComputeOutcome> {
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
				cancel
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

	private disposeChannels(reason: string): void {
		for (const channel of [this.mainChannel, this.slateChannel]) {
			channel?.send(createEnvironmentEnvelope({ sessionId: this.sessionId, kind: 'event', name: 'surface.dispose', payload: { reason } }));
		}
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
	 * Starts a staged Reload: migrates compatible Parameter values into a fresh staged
	 * Store, then boots replacement Containers with the staged snapshot. Commit only
	 * happens when the replacement Canvas reports ready; any failure releases staged
	 * resources and keeps the old Session. At most one replacement at a time.
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
			runtimeConfig: this.runtimeConfig,
			timer: this.timer
		});
		migrateParameterValues(this.store, stagedStore);
		const stagedInspector = new InspectorHost({
			tree: newEntry.inspectorTree,
			store: stagedStore,
			executeAction: (binding) => this.executeAction(binding),
			commandStatus: { subscribe: (handler) => this.runner.subscribeStatus(handler) },
			onActionRejected: (diagnostic) => this.addDiagnostic(diagnostic)
		});
		const handle = new ReloadHandle(this, newEntry, stagedStore, stagedInspector);
		this.reload = handle;
		return { ok: true, handle };
	}

	/**
	 * Atomic commit of the staged replacement: swap entry/store/inspector/sessionId,
	 * dispose the old Containers, promote the replacement channels. Called by
	 * ReloadHandle when the replacement Canvas reports ready.
	 */
	commitReload(handle: ReloadHandle): void {
		if (this.reload !== handle || handle.disposed) return;
		handle.disposed = true;
		handle.clearStartupTimer();

		this.disposeChannels('session-replaced');
		this.entry = handle.newEntry;
		this.store = handle.stagedStore;
		this.inspector = handle.stagedInspector;
		this.sessionId = handle.sessionId;
		this.mainChannel = handle.replacementMain;
		this.slateChannel = handle.replacementSlate;
		this.slateReadyFlag = handle.replacementSlate !== undefined;
		this.wireStore(this.store);
		this.health = 'Responsive';
		this.reload = null;
		this.reloadChannel = undefined;
		this.reloadSessionId = undefined;
		if (this.state !== 'Ready') this.transition('Ready');
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
 * Replacement Session: owns the staged Store/Inspector and the replacement channels.
 * `adoptMain` boots the replacement with the staged snapshot; Canvas ready triggers the
 * atomic commit in ToolSession; startup timeout, cancel or failure releases staged
 * resources and keeps the old Session active.
 */
export class ReloadHandle {
	readonly sessionId: string;
	readonly newEntry: CatalogEntry;
	readonly stagedStore: ParameterStore;
	readonly stagedInspector: InspectorHost;
	replacementMain?: EnvironmentTransport;
	replacementSlate?: EnvironmentTransport;
	disposed = false;

	private readonly session: ToolSession;
	private readonly startupTimer: (callback: () => void) => () => void;
	private startupCancel?: () => void;

	constructor(
		session: ToolSession,
		newEntry: CatalogEntry,
		stagedStore: ParameterStore,
		stagedInspector: InspectorHost
	) {
		this.session = session;
		this.newEntry = newEntry;
		this.stagedStore = stagedStore;
		this.stagedInspector = stagedInspector;
		this.sessionId = crypto.randomUUID();
		session.reloadSessionId = this.sessionId;
		this.startupTimer = (callback) => session.scheduleTimer(callback);
	}

	adoptMain(options: BootOptions): void {
		if (this.disposed) throw new Error('session/reload-disposed');
		this.replacementMain = options.main;
		this.session.reloadChannel = options.main;
		this.replacementMain.subscribe((envelope) => this.onEnvelope(envelope, 'main'));
		// Recompute computed parameters from the migrated inputs once a channel exists.
		this.stagedStore.recomputeComputed();
		this.sendBoot(this.replacementMain, 'main', options.surface, options.inventory);
		this.startupCancel = this.startupTimer(() => this.fail('startup-timeout'));
	}

	adoptSlate(options: { transport: EnvironmentTransport; surface: BootSurface }): void {
		if (this.disposed) throw new Error('session/reload-disposed');
		this.replacementSlate = options.transport;
		this.replacementSlate.subscribe((envelope) => this.onEnvelope(envelope, 'slate'));
		this.sendBoot(this.replacementSlate, 'slate', options.surface);
	}

	onEnvelope(envelope: EnvironmentEnvelope, role: ChannelRole): void {
		if (this.disposed) return;
		if (envelope.sessionId !== this.sessionId) return;
		const validation = validateEnvironmentEnvelope(envelope);
		if (!validation.ok) return;
		const payload = envelope.payload;
		switch (envelope.name) {
			case 'surface.ready': {
				const ready = payload as { endpoint: 'main' | 'slate'; surface: 'canvas' | 'slate' };
				if (role === 'main' && ready.endpoint === 'main' && ready.surface === 'canvas') {
					this.session.commitReload(this);
				}
				return;
			}
			case 'parameter.set': {
				const request = payload as { id: string; value: ParameterValue; expectedRevision: number };
				const result = this.stagedStore.set(request.id, request.value, request.expectedRevision);
				const channel = role === 'main' ? this.replacementMain : this.replacementSlate;
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
				this.session.resolveComputeRequest(envelope.requestId, payload as ComputeOutcome);
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

	// ------------------------------------------------------------------ staged internals

	private sendBoot(channel: EnvironmentTransport, endpoint: 'main' | 'slate', surface: BootSurface, inventory?: EnvironmentInventory): void {
		channel.send(
			createEnvironmentEnvelope({
				sessionId: this.sessionId,
				kind: 'request',
				name: 'boot',
				requestId: `reload-boot-${endpoint}`,
				payload: {
					endpoint,
					parameters: this.stagedStore.snapshot(),
					assets: this.session.assetSnapshot,
					surface,
					inventory: inventory ?? { assets: [], exports: [] }
				}
			})
		);
	}

	private release(reason: string): void {
		if (this.disposed) return;
		this.disposed = true;
		this.clearStartupTimer();
		for (const channel of [this.replacementMain, this.replacementSlate]) {
			channel?.send(
				createEnvironmentEnvelope({ sessionId: this.sessionId, kind: 'event', name: 'surface.dispose', payload: { reason: 'reload-failed' } })
			);
		}
		this.session.reload = null;
		this.session.reloadChannel = undefined;
		this.session.reloadSessionId = undefined;
		if (reason !== 'canceled') {
			this.session.addDiagnostic(error('session/reload-failed', `replacement failed: ${reason}`));
		}
	}
}