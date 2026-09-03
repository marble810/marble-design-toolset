/**
 * Host Parameter Store: constraint/type/mode/revision validation with typed rejection,
 * coalesced updates, computed scheduling waves and Reset Defaults.
 */
import { describe, expect, test } from 'bun:test';
import { ParameterStore } from '../src/index.ts';
import { makeEntry, makeManualCompute, drainMicrotasks } from './helpers.ts';

function makeStore() {
	const manual = makeManualCompute();
	const store = new ParameterStore({
		descriptors: makeEntry().parameters,
		compute: manual.executor,
		runtimeConfig: { computeTimeoutMs: 500 }
	});
	return { store, manual };
}

describe('validation + typed rejection', () => {
	test('manual set commits and bumps per-parameter + store revisions', () => {
		const { store } = makeStore();
		const result = store.set('speed', 5, 0);
		expect(result).toEqual({ accepted: true, id: 'speed', value: 5, revision: 1 });
		expect(store.get('speed')).toBe(5);
		expect(store.revisionOf('speed')).toBe(1);
		expect(store.snapshot().revision).toBe(1);
	});

	test('type mismatch is rejected', () => {
		const { store } = makeStore();
		const result = store.set('speed', 'fast' as unknown as number, 0);
		expect(result.accepted).toBe(false);
		if (!result.accepted) expect(result.diagnostic.code).toBe('parameter/type');
	});

	test('constraint violation is rejected', () => {
		const { store } = makeStore();
		const result = store.set('speed', 99, 0);
		expect(result.accepted).toBe(false);
		if (!result.accepted) expect(result.diagnostic.code).toBe('parameter/constraint');
	});

	test('computed parameters reject direct set with parameter/mode', () => {
		const { store } = makeStore();
		const result = store.set('velocity', 9, 0);
		expect(result.accepted).toBe(false);
		if (!result.accepted) expect(result.diagnostic.code).toBe('parameter/mode');
	});

	test('unknown id and stale revision are rejected', () => {
		const { store } = makeStore();
		expect(store.set('nope', 1, 0).accepted).toBe(false);
		store.set('speed', 2, 0);
		const stale = store.set('speed', 3, 0);
		expect(stale.accepted).toBe(false);
		if (!stale.accepted) expect(stale.diagnostic.code).toBe('parameter/revision');
	});

	test('idempotent set is accepted and does not bump the revision', () => {
		const { store } = makeStore();
		store.set('speed', 5, 0);
		const again = store.set('speed', 5, 1);
		expect(again).toEqual({ accepted: true, id: 'speed', value: 5, revision: 1 });
		expect(store.revisionOf('speed')).toBe(1);
	});

	test('closed store rejects writes', () => {
		const { store } = makeStore();
		store.close();
		const result = store.set('speed', 1, 0);
		expect(result.accepted).toBe(false);
		if (!result.accepted) expect(result.diagnostic.code).toBe('store/closed');
	});
});

describe('coalesced updates', () => {
	test('merge + flush sends exactly one validated commit per id, regardless of drag count', () => {
		const { store } = makeStore();
		const changed: string[] = [];
		store.subscribe((event) => {
			if (event.type === 'changed') changed.push(event.id);
		});

		// pointer-style rapid updates
		for (const value of [1.1, 1.2, 1.3, 1.4]) store.update('speed', value);
		store.update('turbulence', 3);
		expect(changed).toEqual([]); // nothing committed before flush

		const results = store.flush();
		expect(results).toHaveLength(2);
		expect(results[0]).toEqual({ accepted: true, id: 'speed', value: 1.4, revision: 1 });
		expect(results[1]).toEqual({ accepted: true, id: 'turbulence', value: 3, revision: 1 });
		expect(changed).toEqual(['speed', 'turbulence']);
	});

	test('stale coalesced flush is rejected (revision captured at merge time)', () => {
		const { store } = makeStore();
		store.update('speed', 4); // captures revision 0
		store.set('speed', 6, 0); // another source commits first
		const results = store.flush();
		expect(results[0]?.accepted).toBe(false);
		if (results[0] && !results[0].accepted) expect(results[0].diagnostic.code).toBe('parameter/revision');
		expect(store.get('speed')).toBe(6);
	});
});

describe('computed scheduling', () => {
	test('commit schedules a compute wave with the dependency snapshot and commits the result', async () => {
		const { store, manual } = makeStore();
		const changed: Array<{ id: string; value: number }> = [];
		store.subscribe((event) => {
			if (event.type === 'changed') changed.push({ id: event.id, value: event.value as number });
		});

		store.set('speed', 4, 0);
		expect(manual.requests).toHaveLength(1);
		expect(manual.requests[0]?.ids).toEqual(['velocity']);

		manual.resolve({ velocity: 8 });
		await drainMicrotasks();

		expect(store.get('velocity')).toBe(8);
		expect(changed).toContainEqual({ id: 'velocity', value: 8 });
	});

	test('waves are sequential: chained computed params resolve after their dependencies', async () => {
		const entry = makeEntry();
		entry.parameters = {
			...entry.parameters,
			derived: {
				id: 'derived',
				type: 'number',
				label: 'Derived',
				default: 1,
				mode: 'computed',
				constraint: { type: 'number', min: 0, max: 100 },
				dependsOn: ['velocity']
			}
		};
		const manual = makeManualCompute();
		const store = new ParameterStore({ descriptors: entry.parameters, compute: manual.executor });

		store.set('speed', 2, 0);
		expect(manual.requests[0]?.ids).toEqual(['velocity']); // first wave only
		manual.resolve({ velocity: 6 });
		await drainMicrotasks();
		expect(manual.requests[1]?.ids).toEqual(['derived']); // second wave after commit
		manual.resolve({ derived: 12 });
		await drainMicrotasks();

		expect(store.get('velocity')).toBe(6);
		expect(store.get('derived')).toBe(12);
	});

	test('commits during an in-flight wave mark dependents dirty and recompute after', async () => {
		const { store, manual } = makeStore();
		store.set('speed', 5, 0); // default is 1; a real commit schedules the first wave
		manual.resolve({ velocity: 10 });
		await drainMicrotasks();

		store.set('speed', 3, 1); // schedules wave 2 immediately
		store.set('turbulence', 5, 0); // dirty while wave 2 is in flight
		expect(manual.requests).toHaveLength(2);
		manual.resolve({ velocity: 15 }); // wave 2 (stale deps: turbulence was 2)
		await drainMicrotasks();

		// the dirty recompute is scheduled from the fresh dependencies
		expect(manual.requests).toHaveLength(3);
		manual.resolve({ velocity: 15 }); // speed 3 * turbulence 5
		await drainMicrotasks();

		expect(store.get('velocity')).toBe(15);
	});

	test('invalid computed value keeps the last legal value and emits a diagnostic', async () => {
		const { store, manual } = makeStore();
		const diagnostics: string[] = [];
		store.subscribe((event) => {
			if (event.type === 'diagnostic') diagnostics.push(event.diagnostic.code);
		});
		store.set('speed', 2, 0); // default is 1; commits schedule a wave
		manual.resolve({ velocity: 101 }); // > max 100
		await drainMicrotasks();
		expect(store.get('velocity')).toBe(3); // default kept
		expect(diagnostics).toContain('parameter/compute-invalid');
	});

	test('executor failure emits compute-timeout diagnostic and keeps values', async () => {
		const { store, manual } = makeStore();
		const diagnostics: string[] = [];
		store.subscribe((event) => {
			if (event.type === 'diagnostic') diagnostics.push(event.diagnostic.code);
		});
		store.set('speed', 2, 0);
		manual.reject();
		await drainMicrotasks();
		expect(diagnostics).toContain('parameter/compute-timeout');
		expect(store.get('velocity')).toBe(3);
	});

	test('resetDefault restores manual/overrideable defaults and recomputes', async () => {
		const { store, manual } = makeStore();
		store.set('speed', 8, 0);
		store.set('preset', 'storm', 0);
		manual.resolve({ velocity: 4 });
		await drainMicrotasks();

		const results = store.resetDefaults();
		expect(store.get('speed')).toBe(1);
		expect(store.get('preset')).toBe('calm');
		expect(results.filter((r) => r.accepted).length).toBeGreaterThanOrEqual(1);

		manual.resolve({ velocity: 2 });
		await drainMicrotasks();
		expect(store.get('velocity')).toBe(2);
	});
});