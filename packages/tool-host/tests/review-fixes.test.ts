/**
 * Regression tests for the MAB-66 code review findings:
 *  1. Main-only messages (parameter.compute response / command.result / export.result)
 *     are dropped from Slate channels with a typed diagnostic.
 *  2. Explicit recompute (Reset Defaults / Reload migration) schedules leaf computed
 *     parameters and chains in topological order.
 *  3. Session/restart/reload resolve the default Inspector Tree from a shared helper.
 *  4. Restart fully tears down the old runtime (timers, Store, Inspector, Runner,
 *     pending operations) without leaking into the new Session.
 *  5. Slate boot is deferred until Main Ready; reload commit never reports a ready
 *     slate that has not reported surface.ready.
 *  6. Reload migrates Asset state per new-Entry descriptors only.
 */
import { describe, expect, test } from 'bun:test';
import {
	migrateAssetState,
	ToolSession
} from '../src/index.ts';
import {
	createEnvironmentEnvelope,
	type AssetContent,
	type CatalogEntry,
	type EnvironmentEnvelope,
	type ParameterDescriptor
} from 'tool-contract';
import { makeEntry, makeRecordedPair, drainMicrotasks, ManualTimer, type RecordedPair } from './helpers.ts';

type Ctx = { session: ToolSession; timer: ManualTimer; main: RecordedPair };

function makeCtx(entry?: CatalogEntry): Ctx {
	const timer = new ManualTimer();
	const session = new ToolSession({
		entry: entry ?? makeEntry(),
		sessionId: 'session-1',
		runtimeConfig: { startupTimeoutMs: 1000, commandTimeoutMs: 1000, cancelGraceMs: 200, computeTimeoutMs: 500 },
		timer
	});
	const main = makeRecordedPair();
	session.boot({ main: main.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });
	main.sendFromContainer(readyEnvelope(session.sessionId, 'main', 'canvas'));
	return { session, timer, main };
}

function readyEnvelope(sessionId: string, endpoint: 'main' | 'slate', surface: 'canvas' | 'slate'): EnvironmentEnvelope {
	return createEnvironmentEnvelope({
		sessionId,
		kind: 'event',
		name: 'surface.ready',
		payload: { endpoint, surface }
	});
}

function computeResponse(requestId: string, values: Record<string, number>): EnvironmentEnvelope {
	return createEnvironmentEnvelope({
		sessionId: 'session-1',
		kind: 'response',
		name: 'parameter.compute',
		requestId,
		payload: { values }
	});
}

/** Entry with a computed leaf (no computed dependents) whose compute differs from its default. */
function makeEntryWithComputedLeaf(): CatalogEntry {
	const entry = makeEntry();
	const params: Record<string, ParameterDescriptor> = {
		turbulence: {
			id: 'turbulence',
			type: 'number',
			label: 'Turbulence',
			default: 2,
			mode: 'manual',
			constraint: { type: 'number', min: 0, max: 10 }
		},
		doubleTurbulence: {
			id: 'doubleTurbulence',
			type: 'number',
			label: 'Double Turbulence',
			default: 5, // a fake-positive implementation would leave this untouched
			mode: 'computed',
			constraint: { type: 'number', min: 0, max: 100 },
			dependsOn: ['turbulence']
		}
	};
	entry.parameters = params;
	return entry;
}

/** Computed chain leaf1 → leaf2 → leaf3 over one manual root. */
function makeEntryWithComputedChain(): CatalogEntry {
	const entry = makeEntryWithComputedLeaf();
	entry.parameters = {
		turbulence: entry.parameters.turbulence,
		leaf1: {
			id: 'leaf1', type: 'number', label: 'Leaf 1', default: 7, mode: 'computed',
			constraint: { type: 'number', min: 0, max: 100 }, dependsOn: ['turbulence']
		},
		leaf2: {
			id: 'leaf2', type: 'number', label: 'Leaf 2', default: 8, mode: 'computed',
			constraint: { type: 'number', min: 0, max: 100 }, dependsOn: ['leaf1']
		},
		leaf3: {
			id: 'leaf3', type: 'number', label: 'Leaf 3', default: 9, mode: 'computed',
			constraint: { type: 'number', min: 0, max: 100 }, dependsOn: ['leaf2']
		}
	};
	return entry;
}

// ---------------------------------------------------------------------------
// 1. Main-only Environment messages
// ---------------------------------------------------------------------------

describe('main-only environment messages', () => {
	test('slate cannot resolve a pending computed request', async () => {
		const { session, main } = makeCtx();
		const slate = makeRecordedPair();
		session.bootSlate({ transport: slate.pair.host, surface: { kind: 'slate', width: 320, height: 480 } });
		slate.sendFromContainer(readyEnvelope(session.sessionId, 'slate', 'slate'));

		session.store.set('speed', 4, 0);
		const computeRequest = main.fromHost.find((m) => m.name === 'parameter.compute');
		expect(computeRequest).toBeDefined();

		// Slate spoofs the compute response: dropped, pending untouched.
		slate.sendFromContainer(computeResponse(computeRequest?.requestId ?? '', { velocity: 12 }));
		expect(session.getDroppedMessages()).toBeGreaterThan(0);
		expect(session.getDiagnostics().some((d) => d.code === 'session/main-only-message')).toBe(true);
		await drainMicrotasks();
		expect(session.store.get('velocity')).toBe(3); // not resolved by the slate spoof

		// The genuine Main response still resolves the same pending request.
		main.sendFromContainer(computeResponse(computeRequest?.requestId ?? '', { velocity: 12 }));
		await drainMicrotasks();
		expect(session.store.get('velocity')).toBe(12);
	});

	test('slate cannot complete a Main command', () => {
		const { session, main } = makeCtx();
		const slate = makeRecordedPair();
		session.bootSlate({ transport: slate.pair.host, surface: { kind: 'slate', width: 320, height: 480 } });
		slate.sendFromContainer(readyEnvelope(session.sessionId, 'slate', 'slate'));

		const action = session.executeCommand('resimulate');
		expect(action.ok).toBe(true);
		const pending = main.fromHost.find((m) => m.name === 'command.execute');
		const invocationId = action.ok && pending !== undefined ? (pending.payload as { invocationId: string }).invocationId : '';

		// Slate spoofs completion: dropped, the command stays in flight.
		slate.sendFromContainer(createEnvironmentEnvelope({
			sessionId: session.sessionId,
			kind: 'event',
			name: 'command.result',
			payload: { invocationId, ok: true }
		}));
		expect(session.getDiagnostics().some((d) => d.code === 'session/main-only-message')).toBe(true);
		const whileRunning = session.executeCommand('resimulate');
		expect(whileRunning.ok).toBe(false); // single-flight: still active
		if (!whileRunning.ok) expect(whileRunning.diagnostic.code).toBe('command/single-flight');

		// The genuine Main result completes the invocation.
		main.sendFromContainer(createEnvironmentEnvelope({
			sessionId: session.sessionId,
			kind: 'event',
			name: 'command.result',
			payload: { invocationId, ok: true }
		}));
		const after = session.executeCommand('resimulate');
		expect(after.ok).toBe(true);
	});

	test('slate cannot complete an export', async () => {
		const { session, main } = makeCtx();
		const slate = makeRecordedPair();
		session.bootSlate({ transport: slate.pair.host, surface: { kind: 'slate', width: 320, height: 480 } });
		slate.sendFromContainer(readyEnvelope(session.sessionId, 'slate', 'slate'));

		const exportPromise = session.executeExport('still');
		const exportRequest = main.fromHost.find((m) => m.name === 'export.execute');
		const invocationId = (exportRequest?.payload as { invocationId: string }).invocationId;

		// Slate spoofs the export result: dropped, the export stays pending.
		slate.sendFromContainer(createEnvironmentEnvelope({
			sessionId: session.sessionId,
			kind: 'event',
			name: 'export.result',
			payload: { invocationId, ok: true }
		}));
		expect(session.getDiagnostics().some((d) => d.code === 'session/main-only-message')).toBe(true);

		// The genuine Main result completes it.
		main.sendFromContainer(createEnvironmentEnvelope({
			sessionId: session.sessionId,
			kind: 'event',
			name: 'export.result',
			payload: { invocationId, ok: true }
		}));
		await expect(exportPromise).resolves.toEqual({ invocationId, ok: true });
	});

	test('staged reload: the replacement slate cannot resolve a staged compute request', async () => {
		const { session } = makeCtx();
		const result = session.reloadStart(makeEntry());
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const handle = result.handle;

		const replacement = makeRecordedPair();
		handle.adoptMain({ main: replacement.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });
		const computeRequest = replacement.fromHost.find((m) => m.name === 'parameter.compute');
		expect(computeRequest).toBeDefined();
		expect(computeRequest?.sessionId).toBe(handle.sessionId);

		const replacementSlate = makeRecordedPair();
		handle.adoptSlate({ transport: replacementSlate.pair.host, surface: { kind: 'slate', width: 320, height: 480 } });
		expect(replacementSlate.fromHost.filter((m) => m.name === 'boot')).toHaveLength(0); // deferred until Main ready

		// Staged slate spoofs the compute response: dropped, staged store untouched.
		replacementSlate.sendFromContainer(createEnvironmentEnvelope({
			sessionId: handle.sessionId,
			kind: 'response',
			name: 'parameter.compute',
			requestId: computeRequest?.requestId,
			payload: { values: { velocity: 12 } }
		}));
		expect(session.getDroppedMessages()).toBeGreaterThan(0);
		expect(session.getDiagnostics().some((d) => d.code === 'session/main-only-message')).toBe(true);
		await drainMicrotasks();
		expect(handle.stagedStore.get('velocity')).toBe(3);

		// The genuine replacement Main response resolves the same pending request.
		replacement.sendFromContainer(createEnvironmentEnvelope({
			sessionId: handle.sessionId,
			kind: 'response',
			name: 'parameter.compute',
			requestId: computeRequest?.requestId,
			payload: { values: { velocity: 6 } }
		}));
		await drainMicrotasks();
		expect(handle.stagedStore.get('velocity')).toBe(6);
		handle.cancel();
	});
});

// ---------------------------------------------------------------------------
// 2. Computed full recompute
// ---------------------------------------------------------------------------

describe('computed full recompute', () => {
	async function storeWithManualCompute(entry: CatalogEntry) {
		const { ParameterStore } = await import('../src/index.ts');
		let resolveFn: ((values: Record<string, number>) => void) | null = null;
		const requests: string[][] = [];
		const executor = (request: { ids: readonly string[] }) => {
			requests.push([...request.ids]);
			return new Promise((resolve) => {
				resolveFn = (values) => resolve({ values });
			});
		};
		const store = new ParameterStore({
			descriptors: entry.parameters,
			compute: executor as never
		});
		const manual = {
			resolve(values: Record<string, number>) {
				if (resolveFn === null) throw new Error('no compute wave in flight');
				const done = resolveFn;
				resolveFn = null;
				done(values);
			},
			requests
		};
		return { store, manual };
	}

	test('recomputeComputed executes leaf computed parameters (default would mask a no-op)', async () => {
		const { store, manual } = await storeWithManualCompute(makeEntryWithComputedLeaf());
		store.recomputeComputed();
		expect(manual.requests).toHaveLength(1);
		expect(manual.requests[0]).toContain('doubleTurbulence');
		manual.resolve({ doubleTurbulence: 42 });
		await drainMicrotasks();
		expect(store.get('doubleTurbulence')).toBe(42); // 42 ≠ default 5: proof of execution
	});

	test('resetDefaults recomputes leaf computed parameters', async () => {
		const { store, manual } = await storeWithManualCompute(makeEntryWithComputedLeaf());
		store.set('turbulence', 8, 0);
		manual.resolve({ doubleTurbulence: 16 });
		await drainMicrotasks();

		store.resetDefaults();
		// First wave from the restored-default commit, then the explicit full recompute wave.
		manual.resolve({ doubleTurbulence: 42 });
		await drainMicrotasks();
		expect(store.get('turbulence')).toBe(2);
		expect(store.get('doubleTurbulence')).toBe(42);
	});

	test('computed chain recomputes in topological order', async () => {
		const { store, manual } = await storeWithManualCompute(makeEntryWithComputedChain());
		store.recomputeComputed();
		expect(manual.requests[0]).toEqual(['leaf1']);
		manual.resolve({ leaf1: 10 });
		await drainMicrotasks();
		expect(manual.requests[1]).toEqual(['leaf2']);
		manual.resolve({ leaf2: 20 });
		await drainMicrotasks();
		expect(manual.requests[2]).toEqual(['leaf3']);
		manual.resolve({ leaf3: 30 });
		await drainMicrotasks();
		expect(store.get('leaf1')).toBe(10);
		expect(store.get('leaf2')).toBe(20);
		expect(store.get('leaf3')).toBe(30);
	});

	test('Reload migration recomputes leaf computed parameters over the replacement channel', async () => {
		const { session } = makeCtx();
		const result = session.reloadStart(makeEntryWithComputedLeaf());
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const handle = result.handle;

		const replacement = makeRecordedPair();
		handle.adoptMain({ main: replacement.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });
		expect(replacement.fromHost[0]?.name).toBe('boot'); // boot precedes compute
		const computeRequest = replacement.fromHost.find((m) => m.name === 'parameter.compute');
		expect(computeRequest).toBeDefined();
		expect((computeRequest?.payload as { ids: string[] } | undefined)?.ids).toContain('doubleTurbulence');

		replacement.sendFromContainer(createEnvironmentEnvelope({
			sessionId: handle.sessionId,
			kind: 'response',
			name: 'parameter.compute',
			requestId: computeRequest?.requestId,
			payload: { values: { doubleTurbulence: 42 } }
		}));
		await drainMicrotasks();
		expect(handle.stagedStore.get('doubleTurbulence')).toBe(42);

		replacement.sendFromContainer(readyEnvelope(handle.sessionId, 'main', 'canvas'));
		expect(session.getState()).toBe('Ready');
		expect(session.store.get('doubleTurbulence')).toBe(42); // committed state carries the recomputed leaf
	});
});

// ---------------------------------------------------------------------------
// 3. Session auto-generated default Inspector Tree
// ---------------------------------------------------------------------------

describe('default inspector tree resolution', () => {
	function emptyTreeEntry(): CatalogEntry {
		const entry = makeEntry();
		entry.inspectorTree = { elements: [] };
		return entry;
	}

	test('ToolSession with an empty inspectorTree renders the default controls', () => {
		const { session } = makeCtx(emptyTreeEntry());
		const model = session.inspector.viewModel();
		const speed = model.elements.find((e) => 'id' in e && e.id === 'speed');
		expect(speed).toBeDefined();
		const velocity = model.elements.find((e) => 'id' in e && e.id === 'velocity');
		expect(velocity).toBeDefined();
		expect('disabled' in velocity && velocity.disabled).toBe(true); // computed control disabled
	});

	test('Restart keeps the default Inspector', () => {
		const { session, main } = makeCtx(emptyTreeEntry());
		const fresh = makeRecordedPair();
		session.restart({ main: fresh.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });
		const model = session.inspector.viewModel();
		expect(model.elements.some((e) => 'id' in e && e.id === 'speed')).toBe(true);
		expect(model.elements.some((e) => 'id' in e && e.id === 'turbulence')).toBe(true);
		void main;
	});

	test('Reload into an empty-tree entry commits the default Inspector', () => {
		const { session } = makeCtx();
		const result = session.reloadStart(emptyTreeEntry());
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const handle = result.handle;
		const replacement = makeRecordedPair();
		handle.adoptMain({ main: replacement.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });
		replacement.sendFromContainer(readyEnvelope(handle.sessionId, 'main', 'canvas'));
		const model = session.inspector.viewModel();
		const speed = model.elements.find((e) => 'id' in e && e.id === 'speed');
		expect(speed).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// 4. Restart teardown
// ---------------------------------------------------------------------------

describe('restart teardown', () => {
	test('advancing old command timers never marks the new Session Unresponsive', () => {
		const { session, timer, main } = makeCtx();
		const action = session.executeCommand('resimulate');
		expect(action.ok).toBe(true); // in-flight when restarting

		const fresh = makeRecordedPair();
		session.restart({ main: fresh.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });
		fresh.sendFromContainer(readyEnvelope(session.sessionId, 'main', 'canvas'));
		expect(session.getState()).toBe('Ready');
		expect(session.getHealth()).toBe('Responsive');

		// old timeout + cancel-grace timers, and far beyond
		timer.advance(1000 + 200 + 5000);
		expect(session.getHealth()).toBe('Responsive');

		// the new runner is clean: the old command never completes here
		const again = session.executeCommand('resimulate');
		expect(again.ok).toBe(true);
		if (again.ok) {
			fresh.sendFromContainer(createEnvironmentEnvelope({
				sessionId: session.sessionId,
				kind: 'event',
				name: 'command.result',
				payload: { invocationId: again.invocationId, ok: true }
			}));
		}
		void main;
	});

	test('old-session result messages cannot change the new Session', () => {
		const { session, main } = makeCtx();
		const oldId = session.sessionId;
		const action = session.executeCommand('resimulate');
		expect(action.ok).toBe(true);
		const oldInvocation = action.ok ? action.invocationId : '';

		const fresh = makeRecordedPair();
		session.restart({ main: fresh.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });

		// late messages from the old container carry the old session id and the old
		// channel's subscription is gone — they cannot reach the new Session at all
		main.sendFromContainer(createEnvironmentEnvelope({
			sessionId: oldId,
			kind: 'event',
			name: 'command.result',
			payload: { invocationId: oldInvocation, ok: true }
		}));
		main.sendFromContainer(createEnvironmentEnvelope({
			sessionId: oldId,
			kind: 'event',
			name: 'surface.ready',
			payload: { endpoint: 'main', surface: 'canvas' }
		}));
		expect(session.getState()).toBe('Booting'); // old ready did not advance the new session
		expect(session.getHealth()).toBe('Responsive');

		// the new Session completes normally on its own channel
		fresh.sendFromContainer(readyEnvelope(session.sessionId, 'main', 'canvas'));
		expect(session.getState()).toBe('Ready');
	});

	test('old Store/Inspector subscriptions stop emitting and rejects writes', async () => {
		const { session } = makeCtx();
		// leave a compute wave in flight so teardown must reject it silently
		session.store.set('speed', 5, 0);
		const oldStore = session.store;
		const oldInspector = session.inspector;
		const storeEvents: string[] = [];
		const inspectorEvents: number[] = [];
		oldStore.subscribe((event) => storeEvents.push(event.type));
		oldInspector.subscribe((model) => inspectorEvents.push(model.elements.length));

		const fresh = makeRecordedPair();
		session.restart({ main: fresh.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });
		await drainMicrotasks(); // let the teardown rejection propagate through the old store

		expect(storeEvents).toEqual([]); // no diagnostics/events leaked to the old store subscribers
		expect(inspectorEvents).toEqual([]);
		expect(oldStore.set('speed', 1, 0).accepted).toBe(false);
		expect(oldStore.isClosed()).toBe(true);
		oldInspector.setValue('speedSlider', 9); // disposed host ignores input
		expect(oldInspector.viewModel().elements.length).toBeGreaterThan(0); // retained model, no events
		expect(inspectorEvents).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// 5. Slate lifecycle: deferred boot + reload slate plan
// ---------------------------------------------------------------------------

describe('slate lifecycle deferral', () => {
	test('reload commit does not report a not-yet-ready slate, then boots it after Main Ready', () => {
		const { session } = makeCtx();
		const result = session.reloadStart(makeEntry());
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const handle = result.handle;

		const replacement = makeRecordedPair();
		handle.adoptMain({ main: replacement.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });
		const replacementSlate = makeRecordedPair();
		handle.adoptSlate({ transport: replacementSlate.pair.host, surface: { kind: 'slate', width: 320, height: 480 } });
		expect(replacementSlate.fromHost.filter((m) => m.name === 'boot')).toHaveLength(0);

		replacement.sendFromContainer(readyEnvelope(handle.sessionId, 'main', 'canvas'));
		expect(session.getState()).toBe('Ready');
		expect(session.isSlateReady()).toBe(false); // slate exists but has not reported ready

		// the promoted session boots the slate only now
		const slateBoot = replacementSlate.fromHost.find((m) => m.name === 'boot');
		expect(slateBoot).toBeDefined();
		if (slateBoot !== undefined) {
			expect((slateBoot.payload as { endpoint: string }).endpoint).toBe('slate');
		}
		expect(session.isSlateReady()).toBe(false);

		replacementSlate.sendFromContainer(readyEnvelope(session.sessionId, 'slate', 'slate'));
		expect(session.isSlateReady()).toBe(true);
	});

	test('slate timeout after deferred boot keeps Main Ready', () => {
		const { session, timer } = makeCtx();
		const slate = makeRecordedPair();
		session.bootSlate({ transport: slate.pair.host, surface: { kind: 'slate', width: 320, height: 480 } });
		timer.advance(1000);
		expect(session.getState()).toBe('Ready');
		expect(session.isSlateReady()).toBe(false);
		expect(session.getDiagnostics().some((d) => d.code === 'session/slate-timeout')).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 6. Reload Asset migration
// ---------------------------------------------------------------------------

describe('reload asset migration', () => {
	const blob: AssetContent = { kind: 'blob-url', mime: 'image/png', url: 'blob:abc' };
	const dataContent: AssetContent = { kind: 'opaque', mime: 'application/octet-stream', handle: 'h-1' };

	test('migrateAssetState: same id+kind migrates; removed/ret-typed/new slots do not', () => {
		const oldAssets = {
			heightMap: { id: 'heightMap', kind: 'image' as const, label: 'Height Map' },
			flow: { id: 'flow', kind: 'data' as const, label: 'Flow' }
		};
		const oldContents: Record<string, AssetContent | null> = {
			heightMap: blob,
			flow: dataContent
		};
		const newAssets = {
			heightMap: { id: 'heightMap', kind: 'image' as const, label: 'Height Map' },
			flow: { id: 'flow', kind: 'image' as const, label: 'Flow (changed)' },
			mask: { id: 'mask', kind: 'data' as const, label: 'Mask' }
		};
		const migrated = migrateAssetState(oldAssets, oldContents, newAssets);
		expect(migrated.heightMap).toBe(blob); // same id + same kind
		expect(migrated.flow).toBeNull(); // kind changed
		expect(migrated.mask).toBeNull(); // brand-new slot
		expect(Object.keys(migrated)).toEqual(['heightMap', 'flow', 'mask']); // only new-entry slots
	});

	test('replacement boot payload only contains new-entry asset ids', () => {
		const entry = makeEntry();
		entry.assets = { heightMap: { id: 'heightMap', kind: 'image', label: 'Height Map' }, flow: { id: 'flow', kind: 'image', label: 'Flow' } };
		const { session } = makeCtx(entry);
		session.setAsset('heightMap', blob);
		session.setAsset('flow', blob);

		const newEntry = makeEntry();
		newEntry.assets = { heightMap: { id: 'heightMap', kind: 'image', label: 'Height Map' }, mask: { id: 'mask', kind: 'data', label: 'Mask' } };

		const result = session.reloadStart(newEntry);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const handle = result.handle;
		const replacement = makeRecordedPair();
		handle.adoptMain({ main: replacement.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });

		const bootAssetIds = Object.keys((replacement.fromHost[0]?.payload as { assets: { values: Record<string, unknown> } }).assets.values);
		expect(bootAssetIds).toEqual(['heightMap', 'mask']);
		// heightMap migrated (same kind), mask is a new slot → empty
		const bootAssets = (replacement.fromHost[0]?.payload as { assets: { values: Record<string, AssetContent | null> } }).assets.values;
		expect(bootAssets.heightMap).toBe(blob);
		expect(bootAssets.mask).toBeNull();
		handle.cancel();
	});

	test('failed replacement keeps the active Session asset state untouched', () => {
		const { session, timer } = makeCtx();
		session.setAsset('heightMap', blob);

		const newEntry = makeEntry();
		newEntry.assets = {}; // slot removed in the new version
		const result = session.reloadStart(newEntry);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const handle = result.handle;
		const replacement = makeRecordedPair();
		handle.adoptMain({ main: replacement.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });

		timer.advance(1000); // replacement fails to become ready
		expect(session.getState()).toBe('Ready');
		expect(session.assetSnapshot.values.heightMap).toBe(blob); // untouched
		expect(Object.keys(session.assetSnapshot.values)).toContain('heightMap');
	});

	test('successful commit installs the staged migrated asset state', () => {
		const entry = makeEntry();
		entry.assets = { heightMap: { id: 'heightMap', kind: 'image', label: 'Height Map' }, flow: { id: 'flow', kind: 'image', label: 'Flow' } };
		const { session } = makeCtx(entry);
		session.setAsset('heightMap', blob);
		session.setAsset('flow', blob);

		const newEntry = makeEntry();
		newEntry.assets = { heightMap: { id: 'heightMap', kind: 'image', label: 'Height Map' }, mask: { id: 'mask', kind: 'data', label: 'Mask' } };
		const result = session.reloadStart(newEntry);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const handle = result.handle;
		const replacement = makeRecordedPair();
		handle.adoptMain({ main: replacement.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });
		replacement.sendFromContainer(readyEnvelope(handle.sessionId, 'main', 'canvas'));

		expect(session.assetSnapshot.values).toEqual({ heightMap: blob, mask: null });
		expect(Object.keys(session.assetSnapshot.values)).not.toContain('flow');
	});
});
