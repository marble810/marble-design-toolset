/**
 * Retained Standard Inspector: default tree generation, store mirroring, computed
 * controls disabled, coalesced input (no envelope traffic until flush), and button
 * single-flight state via command status events.
 */
import { describe, expect, test } from 'bun:test';
import type { InspectorBinding } from 'tool-contract';
import {
	InspectorHost,
	buildDefaultInspectorTree,
	ToolCommandRunner,
	ToolSession,
	type InspectorNodeState,
	type InspectorViewModel
} from '../src/index.ts';
import { makeEntry, makeRecordedPair, ManualTimer } from './helpers.ts';

function makeHost() {
	const entry = makeEntry();
	const timer = new ManualTimer();
	const session = new ToolSession({
		entry,
		sessionId: 'session-1',
		runtimeConfig: { startupTimeoutMs: 1000, commandTimeoutMs: 1000, cancelGraceMs: 200, computeTimeoutMs: 500 },
		timer
	});
	return { session, timer };
}

function makeStandaloneHost() {
	const entry = makeEntry();
	const timer = new ManualTimer();
	const session = new ToolSession({ entry, sessionId: 'session-1', timer });
	const runner = new ToolCommandRunner({
		runtimeConfig: { startupTimeoutMs: 1000, commandTimeoutMs: 1000, cancelGraceMs: 200, computeTimeoutMs: 500 },
		timer,
		sendExecute: () => {},
		sendCancel: () => {},
		onUnresponsive: () => {}
	});
	const executeAction = (binding: InspectorBinding) => {
		if (binding.kind === 'command') return runner.execute(binding.commandId);
		if (binding.kind === 'private-callback') return runner.execute(binding.callbackId);
		return { ok: false as const, diagnostic: { severity: 'error' as const, code: 'x', message: 'x' } };
	};
	const host = new InspectorHost({
		tree: entry.inspectorTree,
		store: session.store,
		executeAction,
		commandStatus: { subscribe: (handler) => runner.subscribeStatus(handler) }
	});
	return { host, runner, session };
}

function find(state: InspectorViewModel, id: string) {
	const walk = (nodes: readonly InspectorNodeState[]): InspectorNodeState | undefined => {
		for (const node of nodes) {
			if (node.id === id) return node;
			const found = node.children !== undefined ? walk(node.children) : undefined;
			if (found !== undefined) return found;
		}
		return undefined;
	};
	return walk(state.elements);
}

describe('default tree', () => {
	test('buildDefaultInspectorTree creates one control per parameter', () => {
		const tree = buildDefaultInspectorTree(makeEntry().parameters);
		const kinds = new Map(tree.elements.map((e) => [e.id, e.kind]));
		expect(kinds.get('speed')).toBe('slider');
		expect(kinds.get('turbulence')).toBe('slider');
		expect(kinds.get('preset')).toBe('select');
		expect(kinds.get('velocity')).toBe('slider'); // computed still shows a control
		expect(tree.elements).toHaveLength(4);
	});
});

describe('InspectorHost', () => {
	test('view model mirrors store values and marks computed controls disabled', () => {
		const { host } = makeStandaloneHost();
		const model = host.viewModel();
		const speed = find(model, 'speedSlider');
		expect(speed?.value).toBe(1);
		expect(speed?.disabled).toBe(false);
		const preset = find(model, 'calmToggle');
		expect(preset?.value).toBe('calm');
	});

	test('setValue merges into the store; nothing is committed until flush', () => {
		const { host, session } = makeStandaloneHost();
		const recorderPair = makeRecordedPair();
		session.boot({ main: recorderPair.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });

		host.setValue('speedSlider', 8);
		expect(session.store.get('speed')).toBe(1); // not committed yet
		expect(recorderPair.fromHost.filter((m) => m.name === 'parameter.changed')).toHaveLength(0); // pointer events never cross

		host.flushValues();
		expect(session.store.get('speed')).toBe(8);
		expect(recorderPair.fromHost.filter((m) => m.name === 'parameter.changed')).toHaveLength(1);
	});

	test('button trigger runs the action and reflects running state until the result arrives', () => {
		const { host, runner } = makeStandaloneHost();
		const result = host.trigger('resimulateButton');
		expect(result.ok).toBe(true);
		expect(find(host.viewModel(), 'resimulateButton')?.running).toBe(true);
		// second trigger while running is rejected
		const second = host.trigger('resimulateButton');
		expect(second.ok).toBe(false);
		if (!second.ok) expect(second.diagnostic.code).toBe('command/single-flight');
		if (result.ok) runner.onResult(result.invocationId, true);
		expect(find(host.viewModel(), 'resimulateButton')?.running).toBe(false);
	});

	test('private callback buttons use the same mechanism and state', () => {
		const { host, runner } = makeStandaloneHost();
		const result = host.trigger('seedButton');
		expect(result.ok).toBe(true);
		expect(find(host.viewModel(), 'seedButton')?.running).toBe(true);
		if (result.ok) runner.onResult(result.invocationId, true);
		expect(find(host.viewModel(), 'seedButton')?.running).toBe(false);
	});

	test('store changes propagate to the view model', () => {
		const { host, session } = makeStandaloneHost();
		session.store.set('speed', 7, 0);
		expect(find(host.viewModel(), 'speedSlider')?.value).toBe(7);
	});

	test('subscribe notifies listeners with the full view model', () => {
		const { host } = makeStandaloneHost();
		const received: InspectorViewModel[] = [];
		host.subscribe((model) => received.push(model));
		host.setValue('speedSlider', 3);
		expect(received.length).toBeGreaterThan(0);
		expect(received[0]?.elements.length).toBeGreaterThan(0);
	});

	test('session inspector: host controls set parameters through the coalescing path end-to-end', () => {
		const { session } = makeHost();
		const recorder = makeRecordedPair();
		session.boot({ main: recorder.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });

		for (const value of [1, 2, 3]) session.inspector.setValue('speedSlider', value);
		const results = session.inspector.flushValues();
		expect(results).toHaveLength(1);
		expect(results[0]).toMatchObject({ accepted: true, id: 'speed', value: 3 });
		expect(session.store.get('speed')).toBe(3);
	});
});