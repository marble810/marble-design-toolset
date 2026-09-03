/**
 * Deterministic test helpers: manual timer with exact advancement, a valid Catalog Entry
 * fixture builder, and a compute executor that resolves from a pure mapping.
 */
import {
	createInMemoryTransportPair,
	type CatalogEntry,
	type EnvironmentEnvelope,
	type ParameterDescriptor
} from 'tool-contract';
import type { Timer } from '../src/timer.ts';
import type { ComputeExecutor } from '../src/parameter-store.ts';

export class ManualTimer implements Timer {
	now = 0;
	private queue: Array<{ at: number; callback: () => void; id: number }> = [];
	private nextId = 1;

	schedule(callback: () => void, ms: number): () => void {
		const id = this.nextId++;
		this.queue.push({ at: this.now + ms, callback, id });
		this.queue.sort((a, b) => a.at - b.at || a.id - b.id);
		return () => {
			this.queue = this.queue.filter((entry) => entry.id !== id);
		};
	}

	/** Runs every callback scheduled at or before `ms` (including newly scheduled ones). */
	advance(ms: number): void {
		const target = this.now + ms;
		for (;;) {
			const next = this.queue[0];
			if (next === undefined || next.at > target) break;
			this.queue.shift();
			this.now = next.at;
			next.callback();
		}
		this.now = target;
	}

	pendingCount(): number {
		return this.queue.length;
	}
}

export function makeEntry(overrides?: Partial<CatalogEntry>): CatalogEntry {
	const parameters: Record<string, ParameterDescriptor> = {
		speed: {
			id: 'speed',
			type: 'number',
			label: 'Speed',
			default: 1,
			mode: 'manual',
			constraint: { type: 'number', min: 0, max: 10 }
		},
		turbulence: {
			id: 'turbulence',
			type: 'number',
			label: 'Turbulence',
			default: 2,
			mode: 'manual',
			constraint: { type: 'number', min: 0, max: 10 }
		},
		velocity: {
			id: 'velocity',
			type: 'number',
			label: 'Velocity (computed)',
			default: 3,
			mode: 'computed',
			constraint: { type: 'number', min: 0, max: 100 },
			dependsOn: ['speed', 'turbulence']
		},
		preset: {
			id: 'preset',
			type: 'select',
			label: 'Preset',
			default: 'calm',
			mode: 'overrideable',
			constraint: { type: 'select', options: ['calm', 'storm'] }
		}
	};

	const entry: CatalogEntry = {
		catalogEntryId: 'web:1:web:1:shallow-water',
		source: { kind: 'web', sourceId: 'web-catalog' },
		projectId: 'project-1',
		slug: 'shallow-water',
		name: 'Shallow Water',
		version: '1.0.0',
		forgeProfile: 'forge-v1',
		libraries: [],
		artifacts: { main: 'main.js' },
		parameters,
		assets: { heightMap: { id: 'heightMap', kind: 'image', label: 'Height Map' } },
		commands: { resimulate: { id: 'resimulate', label: 'Re-simulate' } },
		privateCallbacks: { seed: { id: 'seed' } },
		outputs: { still: { id: 'still', kind: 'image', label: 'Still', mime: 'image/png' } },
		inspectorTree: {
			elements: [
				{ kind: 'slider', id: 'speedSlider', label: 'Speed', binding: { kind: 'parameter', parameterId: 'speed' } },
				{ kind: 'toggle', id: 'calmToggle', label: 'Calm', binding: { kind: 'parameter', parameterId: 'preset' } },
				{ kind: 'button', id: 'resimulateButton', label: 'Re-simulate', binding: { kind: 'command', commandId: 'resimulate' } },
				{ kind: 'button', id: 'seedButton', label: 'Seed', binding: { kind: 'private-callback', callbackId: 'seed' } }
			]
		},
		surfaces: { canvas: true, slate: false },
		...overrides
	};
	return entry;
}

/** Transport pair that records every envelope delivered to the host end. */
export function makeRecordedPair() {
	const pair = createInMemoryTransportPair();
	const fromContainer: EnvironmentEnvelope[] = [];
	const fromHost: EnvironmentEnvelope[] = [];
	pair.host.subscribe((message) => fromContainer.push(message));
	pair.container.subscribe((message) => fromHost.push(message));
	return {
		pair,
		fromContainer, // container → host (what the session receives)
		fromHost, // host → container (what the session sends)
		sendFromContainer: (message: EnvironmentEnvelope) => pair.container.send(message)
	};
}

export type RecordedPair = ReturnType<typeof makeRecordedPair>;

/** Manual compute executor: waves are resolved/rejected explicitly by the test. */
export function makeManualCompute() {
	let resolveFn: ((values: Record<string, number>) => void) | null = null;
	let rejectFn: (() => void) | null = null;
	let currentValue: { ids: string[]; dependencies: { revision: number; values: Record<string, number | boolean | string> } } | null = null;
	const requests: Array<{ ids: string[]; revision: number }> = [];

	const executor: ComputeExecutor = (request) => {
		requests.push({ ids: [...request.ids], revision: request.dependencies.revision });
		currentValue = { ids: [...request.ids], dependencies: request.dependencies };
		return new Promise((resolve, reject) => {
			resolveFn = (values) => resolve({ values });
			rejectFn = () => reject(new Error('compute-failed'));
		});
	};

	return {
		executor,
		requests,
		get current() {
			return currentValue;
		},
		resolve(values: Record<string, number>) {
			if (resolveFn === null) throw new Error('no compute wave in flight');
			const done = resolveFn;
			resolveFn = null;
			rejectFn = null;
			currentValue = null;
			done(values);
		},
		reject() {
			if (rejectFn === null) throw new Error('no compute wave in flight');
			const fail = rejectFn;
			resolveFn = null;
			rejectFn = null;
			currentValue = null;
			fail();
		}
	};
}

export type { EnvironmentEnvelope };
/** Drains the microtask queue far enough for chained promise resolution (executor → session → store). */
export async function drainMicrotasks(times = 25): Promise<void> {
	for (let i = 0; i < times; i++) {
		await Promise.resolve();
	}
}
