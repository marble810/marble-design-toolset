/**
 * Host-owned Parameter Store: the single authority for Parameter values inside a Tool
 * Session. Built only from Catalog Entry descriptors, so it exists before any Container
 * boots. It owns type/mode/Constraint validation, per-parameter revisions with stale
 * write rejection, coalesced updates for host controls, and Host-scheduled computed
 * scheduling (the Main Container only runs short compute callbacks).
 *
 * Pointer events never reach this module: controls merge locally via `update()` and the
 * app flushes on rAF/pointerup through `flush()`.
 */
import {
	error,
	type Diagnostic,
	type ParameterDescriptor,
	type ParameterSnapshot,
	type ParameterValue
} from 'tool-contract';
import type { DeshelfRuntimeConfig } from './runtime-config.ts';
import { resolveRuntimeConfig } from './runtime-config.ts';
import type { Timer } from './timer.ts';
import { defaultTimer } from './timer.ts';

export type ParameterSetResult =
	| { accepted: true; id: string; value: ParameterValue; revision: number }
	| { accepted: false; id: string; diagnostic: Diagnostic };

export interface ComputeRequest {
	ids: readonly string[];
	dependencies: ParameterSnapshot;
}

export interface ComputeOutcome {
	values: Record<string, ParameterValue>;
	diagnostics?: readonly Diagnostic[];
	/**
	 * Host-side deferral: no compute channel existed when the wave ran (HostReady phase
	 * or pre-adoption staging). The wave stays dirty and retries after Main boot or on
	 * the next commit instead of being consumed as "completed with no values".
	 */
	defer?: boolean;
}

/** Host wiring: the session sends `parameter.compute` over the Main channel and resolves with the reply. */
export type ComputeExecutor = (request: ComputeRequest) => Promise<ComputeOutcome>;

export type ParameterStoreEvent =
	| { type: 'changed'; id: string; value: ParameterValue; revision: number }
	| { type: 'diagnostic'; diagnostic: Diagnostic };

export type Unsubscribe = () => void;

export interface ParameterStoreOptions {
	descriptors: Record<string, ParameterDescriptor>;
	compute: ComputeExecutor;
	/**
	 * Host wiring: true when a compute channel is available (false during HostReady, so
	 * waves stay dirty instead of being consumed or timed out prematurely).
	 */
	canCompute?: () => boolean;
	runtimeConfig?: Partial<DeshelfRuntimeConfig>;
	timer?: Timer;
}

function reject(id: string, code: string, message: string): ParameterSetResult {
	return { accepted: false, id, diagnostic: error(code, message, id) };
}

/** Type + Constraint validation for a candidate value. Returns a Diagnostic on failure. */
export function validateParameterValue(descriptor: ParameterDescriptor, value: unknown): Diagnostic | undefined {
	switch (descriptor.type) {
		case 'number': {
			if (typeof value !== 'number' || !Number.isFinite(value)) {
				return error('parameter/type', `'${descriptor.id}' expects a finite number`, descriptor.id);
			}
			const c = descriptor.constraint;
			if (c.type === 'number' && (value < c.min || value > c.max)) {
				return error('parameter/constraint', `'${descriptor.id}' value out of range [${c.min}, ${c.max}]`, descriptor.id);
			}
			return undefined;
		}
		case 'boolean': {
			if (typeof value !== 'boolean') {
				return error('parameter/type', `'${descriptor.id}' expects a boolean`, descriptor.id);
			}
			return undefined;
		}
		case 'select': {
			if (typeof value !== 'string') {
				return error('parameter/type', `'${descriptor.id}' expects a string option`, descriptor.id);
			}
			const c = descriptor.constraint;
			if (c.type === 'select' && !c.options.includes(value)) {
				return error('parameter/constraint', `'${descriptor.id}' value must be one of ${c.options.join(', ')}`, descriptor.id);
			}
			return undefined;
		}
		case 'string': {
			if (typeof value !== 'string') {
				return error('parameter/type', `'${descriptor.id}' expects a string`, descriptor.id);
			}
			const c = descriptor.constraint;
			if (c.type === 'string' && c.maxLength !== undefined && value.length > c.maxLength) {
				return error('parameter/constraint', `'${descriptor.id}' exceeds maxLength ${c.maxLength}`, descriptor.id);
			}
			return undefined;
		}
	}
}

export class ParameterStore {
	private readonly descriptors: Record<string, ParameterDescriptor>;
	private readonly executor: ComputeExecutor;
	private readonly canCompute?: () => boolean;
	private readonly runtimeConfig: DeshelfRuntimeConfig;
	private readonly timer: Timer;

	private readonly values = new Map<string, ParameterValue>();
	private readonly revisions = new Map<string, number>();
	private storeRevision = 0;

	/** Coalesced updates from host controls, pending an app-driven flush. */
	private readonly pending = new Map<string, { value: ParameterValue; expectedRevision: number }>();

	/** Computed params waiting to be scheduled. */
	private pendingComputed = new Set<string>();
	private computeInFlight = false;

	/** depId → computed ids that directly depend on it (computed-only edges). */
	private readonly dependents = new Map<string, string[]>();

	private closed = false;
	private readonly listeners = new Set<(event: ParameterStoreEvent) => void>();

	constructor(options: ParameterStoreOptions) {
		this.descriptors = options.descriptors;
		this.executor = options.compute;
		this.canCompute = options.canCompute;
		this.runtimeConfig = resolveRuntimeConfig(options.runtimeConfig);
		this.timer = options.timer ?? defaultTimer;

		for (const id of Object.keys(this.descriptors)) {
			const descriptor = this.descriptors[id];
			this.values.set(id, descriptor.default);
			this.revisions.set(id, 0);
			if (descriptor.mode === 'computed') {
				for (const dep of descriptor.dependsOn ?? []) {
					const list = this.dependents.get(dep) ?? [];
					list.push(id);
					this.dependents.set(dep, list);
				}
			}
		}
	}

	// ------------------------------------------------------------------ reads

	get(id: string): ParameterValue | undefined {
		return this.values.get(id);
	}

	descriptor(id: string): ParameterDescriptor | undefined {
		return this.descriptors[id];
	}

	allDescriptors(): Record<string, ParameterDescriptor> {
		return this.descriptors;
	}

	revisionOf(id: string): number {
		return this.revisions.get(id) ?? 0;
	}

	snapshot(): ParameterSnapshot {
		return {
			revision: this.storeRevision,
			values: Object.fromEntries(this.values),
			revisions: Object.fromEntries(this.revisions)
		};
	}

	isClosed(): boolean {
		return this.closed;
	}

	// ------------------------------------------------------------------ writes

	/**
	 * Validated commit. `expectedRevision` is the caller's last observed per-parameter
	 * revision; a stale value (already superseded) is rejected with a typed diagnostic.
	 * Computed parameters are never settable. Idempotent sets are accepted unchanged.
	 */
	set(id: string, value: ParameterValue, expectedRevision?: number): ParameterSetResult {
		if (this.closed) return reject(id, 'store/closed', 'parameter store is closed');
		const descriptor = this.descriptors[id];
		if (descriptor === undefined) return reject(id, 'parameter/unknown', `unknown parameter '${id}'`);
		if (descriptor.mode === 'computed') {
			return reject(id, 'parameter/mode', `'${id}' is computed and cannot be set directly`);
		}
		const invalid = validateParameterValue(descriptor, value);
		if (invalid !== undefined) return { accepted: false, id, diagnostic: invalid };
		if (expectedRevision !== undefined && expectedRevision !== this.revisions.get(id)) {
			return reject(
				id,
				'parameter/revision',
				`stale write for '${id}': expected revision ${expectedRevision}, current ${this.revisions.get(id) ?? 0}`
			);
		}
		if (this.values.get(id) === value) {
			return { accepted: true, id, value, revision: this.revisions.get(id) ?? 0 };
		}
		const revision = this.commit(id, value);
		this.scheduleComputed([id]);
		return { accepted: true, id, value, revision };
	}

	/** Coalesced merge from a host control; no envelope is sent until `flush()`. */
	update(id: string, value: ParameterValue): void {
		if (this.closed) return;
		const expectedRevision = this.revisions.get(id) ?? 0;
		this.pending.set(id, { value, expectedRevision });
	}

	/** Applies all merged updates as a single batch; returns per-parameter results. */
	flush(): ParameterSetResult[] {
		if (this.closed) return [];
		const entries = [...this.pending.entries()];
		this.pending.clear();
		return entries.map(([id, entry]) => this.set(id, entry.value, entry.expectedRevision));
	}

	/** Reset Defaults: restore manual/overrideable defaults and recompute every computed parameter. */
	resetDefaults(): ParameterSetResult[] {
		if (this.closed) return [];
		const results: ParameterSetResult[] = [];
		const computedIds: string[] = [];
		for (const id of Object.keys(this.descriptors)) {
			const descriptor = this.descriptors[id];
			if (descriptor.mode === 'computed') {
				computedIds.push(id);
				continue;
			}
			if (this.values.get(id) === descriptor.default) continue;
			results.push(this.set(id, descriptor.default as ParameterValue));
		}
		// Explicit full recompute: every computed id (including leaves without dependents)
		// and any downstream dependent chains, in topological waves.
		this.scheduleRecompute(computedIds);
		return results;
	}

	/** Recomputes every computed parameter from current values (used after Reload migration). */
	recomputeComputed(): void {
		if (this.closed) return;
		this.scheduleRecompute(
			Object.keys(this.descriptors).filter((id) => this.descriptors[id]?.mode === 'computed')
		);
	}

	/** Re-pumps waves deferred while no compute channel existed (e.g. called after Main boot). */
	retryPendingComputed(): void {
		if (this.closed) return;
		this.pump();
	}

	/**
	 * Migration-only seed used by staged Reload: commits a value that already passed the
	 * new descriptor's validation, without change events or recompute scheduling.
	 */
	seed(id: string, value: ParameterValue): void {
		if (this.closed) return;
		this.values.set(id, value);
		this.revisions.set(id, (this.revisions.get(id) ?? 0) + 1);
		this.storeRevision += 1;
	}

	close(): void {
		if (this.closed) return;
		this.closed = true;
		this.pending.clear();
		this.pendingComputed.clear();
	}

	subscribe(listener: (event: ParameterStoreEvent) => void): Unsubscribe {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	// ------------------------------------------------------------------ internals

	private commit(id: string, value: ParameterValue): number {
		this.values.set(id, value);
		const revision = (this.revisions.get(id) ?? 0) + 1;
		this.revisions.set(id, revision);
		this.storeRevision += 1;
		for (const listener of [...this.listeners]) {
			listener({ type: 'changed', id, value, revision });
		}
		return revision;
	}

	private emitDiagnostic(diagnostic: Diagnostic): void {
		for (const listener of [...this.listeners]) {
			listener({ type: 'diagnostic', diagnostic });
		}
	}

	/**
	 * Marks computed params transitively affected by changed manual/overrideable values
	 * and starts scheduling. The changed ids themselves are never re-executed here — this
	 * is the dependents-only path for value commits.
	 */
	private scheduleComputed(changedIds: readonly string[]): void {
		if (this.closed || this.pendingComputed.size === 0 && changedIds.length === 0) return;
		const affected = this.collectAffected(changedIds);
		if (affected.size === 0) return;
		for (const id of affected) this.pendingComputed.add(id);
		this.pump();
	}

	/**
	 * Explicit recompute of specific computed ids: the roots themselves (including leaves
	 * without dependents) plus their downstream dependent chains, in topological waves.
	 * Used by Reset Defaults and staged Reload migration.
	 */
	private scheduleRecompute(roots: readonly string[]): void {
		if (this.closed) return;
		const computedRoots = roots.filter((id) => this.descriptors[id]?.mode === 'computed');
		if (computedRoots.length === 0) return;
		const affected = this.collectAffected(computedRoots);
		for (const id of computedRoots) affected.add(id);
		for (const id of affected) this.pendingComputed.add(id);
		this.pump();
	}

	private collectAffected(changedIds: readonly string[]): Set<string> {
		const affected = new Set<string>();
		const stack = [...changedIds];
		while (stack.length > 0) {
			const id = stack.pop() as string;
			for (const dependent of this.dependents.get(id) ?? []) {
				if (!affected.has(dependent)) {
					affected.add(dependent);
					stack.push(dependent);
				}
			}
		}
		return affected;
	}

	/**
	 * Executes the next computable wave: computed params whose own computed dependencies
	 * are not part of the current batch. Waves run sequentially — each response commits
	 * before the next wave starts — and a batch that can never satisfy its dependencies
	 * simply waits for a future commit (no busy loop).
	 */
	private pump(): void {
		if (this.closed || this.computeInFlight || this.pendingComputed.size === 0) return;
		// No compute channel yet (HostReady phase / pre-adoption staging): leave the waves
		// dirty — they are retried by retryPendingComputed() after Main boot or by the
		// next commit, instead of being consumed as "completed with no values".
		if (this.canCompute !== undefined && !this.canCompute()) return;
		const wave: string[] = [];
		for (const id of this.pendingComputed) {
			const ready = (this.descriptors[id]?.dependsOn ?? []).every((dep) => {
				const depDescriptor = this.descriptors[dep];
				if (depDescriptor === undefined || depDescriptor.mode !== 'computed') return true;
				return !this.pendingComputed.has(dep);
			});
			if (ready) wave.push(id);
		}
		if (wave.length === 0) return;

		for (const id of wave) this.pendingComputed.delete(id);
		this.computeInFlight = true;
		const request: ComputeRequest = { ids: wave, dependencies: this.snapshot() };
		void this.runCompute(request);
	}

	private async runCompute(request: ComputeRequest): Promise<void> {
		let outcome: ComputeOutcome;
		try {
			outcome = await this.executor(request);
		} catch {
			// Teardown (restart/close/release) rejected this batch: the store is closed and
			// the session already detached its subscriptions — stay silent.
			if (this.closed) return;
			// Executor failure (transport error / timeout): keep the last legal values,
			// report a diagnostic, and leave the wave dirty so a future commit retries.
			this.emitDiagnostic(
				error('parameter/compute-timeout', `computed batch [${request.ids.join(', ')}] did not complete`, request.ids.join(','))
			);
			for (const id of request.ids) this.pendingComputed.add(id);
			this.computeInFlight = false;
			return;
		}
		if (this.closed) return;
		this.computeInFlight = false;
		if (outcome.defer === true) {
			// No channel existed (HostReady / pre-adoption staging): keep the wave dirty so
			// Main boot (retryPendingComputed) or the next commit re-pumps it. Do NOT pump
			// here — the same wave would be ready again and the loop would never end.
			for (const id of request.ids) this.pendingComputed.add(id);
			return;
		}
		this.commitComputed(request.ids, outcome);
		this.pump();
	}

	/** Validates and commits computed results; illegal values keep the last legal value + diagnostic. */
	private commitComputed(ids: readonly string[], outcome: ComputeOutcome): void {
		if (this.closed) return;
		for (const diagnostic of outcome.diagnostics ?? []) this.emitDiagnostic(diagnostic);
		for (const id of ids) {
			const value = outcome.values[id];
			if (value === undefined) continue;
			const descriptor = this.descriptors[id];
			if (descriptor === undefined) continue;
			const invalid = validateParameterValue(descriptor, value);
			if (invalid !== undefined) {
				this.emitDiagnostic(error('parameter/compute-invalid', `computed '${id}' rejected: ${invalid.message}`, id));
				continue;
			}
			if (this.values.get(id) === value) continue;
			this.commit(id, value);
		}
	}
}