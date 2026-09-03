import { describe, expect, test } from 'bun:test';
import { ToolSession } from '../src/index.ts';
import { createEnvironmentEnvelope, type AssetContent, type EnvironmentEnvelope } from 'tool-contract';
import { drainMicrotasks, makeEntry, makeRecordedPair, ManualTimer } from './helpers.ts';

function ready(sessionId: string, endpoint: 'main' | 'slate' = 'main', surface: 'canvas' | 'slate' = 'canvas'): EnvironmentEnvelope {
	return createEnvironmentEnvelope({ sessionId, kind: 'event', name: 'surface.ready', payload: { endpoint, surface } });
}

function makeReadySession(options?: { assetResolver?: (id: string) => AssetContent | null | Promise<AssetContent | null> }) {
	const timer = new ManualTimer();
	const session = new ToolSession({
		entry: makeEntry(),
		sessionId: 'session-1',
		timer,
		runtimeConfig: { startupTimeoutMs: 1000, commandTimeoutMs: 1000, cancelGraceMs: 200, computeTimeoutMs: 500 },
		...options
	});
	const main = makeRecordedPair();
	session.boot({ main: main.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });
	main.sendFromContainer(ready(session.sessionId));
	return { session, main, timer };
}

describe('review round 5 regressions', () => {
	test('staged Inspector actions stay disabled until replacement commit', () => {
		const { session } = makeReadySession();
		const result = session.reloadStart(makeEntry());
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const handle = result.handle;

		expect(handle.stagedInspector.trigger('resimulateButton').ok).toBe(false);
		const replacement = makeRecordedPair();
		handle.adoptMain({ main: replacement.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });
		expect(handle.stagedInspector.trigger('resimulateButton').ok).toBe(false);
		expect(replacement.fromHost.filter((message) => message.name === 'command.execute')).toHaveLength(0);

		replacement.sendFromContainer(ready(handle.sessionId));
		expect(session.inspector.trigger('resimulateButton').ok).toBe(true);
		expect(replacement.fromHost.filter((message) => message.name === 'command.execute')).toHaveLength(1);
	});

	test('replacement endpoint mismatches are diagnosed and do not commit', () => {
		const { session } = makeReadySession();
		const result = session.reloadStart(makeEntry());
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const handle = result.handle;
		const replacement = makeRecordedPair();
		handle.adoptMain({ main: replacement.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });
		const slate = makeRecordedPair();
		handle.adoptSlate({ transport: slate.pair.host, surface: { kind: 'slate', width: 320, height: 480 } });

		replacement.sendFromContainer(ready(handle.sessionId, 'slate', 'slate'));
		slate.sendFromContainer(ready(handle.sessionId, 'main', 'canvas'));
		expect(session.getDiagnostics().filter((diagnostic) => diagnostic.code === 'session/endpoint-mismatch')).toHaveLength(2);
		expect(session.hasActiveReload()).toBe(true);
		handle.cancel();
	});

	test('asset resolver completion is suppressed after the same slot changes', async () => {
		let resolveAsset: ((content: AssetContent | null) => void) | undefined;
		const { session, main } = makeReadySession({
			assetResolver: () => new Promise((resolve) => { resolveAsset = resolve; })
		});
		main.sendFromContainer(createEnvironmentEnvelope({
			sessionId: session.sessionId,
			kind: 'request',
			name: 'asset.request',
			requestId: 'asset-old',
			payload: { assetId: 'heightMap' }
		}));
		session.setAsset('heightMap', { kind: 'blob-url', mime: 'image/png', url: 'blob:new' });
		resolveAsset?.({ kind: 'blob-url', mime: 'image/png', url: 'blob:old' });
		await drainMicrotasks();
		expect(main.fromHost.filter((message) => message.kind === 'response' && message.requestId === 'asset-old')).toHaveLength(0);
	});

	test('unknown output is rejected without timer or outbound export', async () => {
		const { session, main, timer } = makeReadySession();
		const beforeTimers = timer.pendingCount();
		const beforeExports = main.fromHost.filter((message) => message.name === 'export.execute').length;
		const promise = session.executeExport('missing-output');
		// A correct implementation rejects immediately and arms no timer. Advancing the
		// manual clock also makes the current buggy implementation settle deterministically.
		timer.advance(1000);
		await expect(promise).rejects.toThrow('export/unknown');
		expect(timer.pendingCount()).toBe(beforeTimers);
		expect(main.fromHost.filter((message) => message.name === 'export.execute')).toHaveLength(beforeExports);
	});

	test('compute requests from a Container cannot resolve Host pending compute', async () => {
		const { session, main } = makeReadySession();
		const revision = session.store.snapshot().revisions.speed ?? 0;
		session.store.set('speed', 4, revision);
		const compute = main.fromHost.filter((message) => message.name === 'parameter.compute').at(-1);
		expect(compute?.kind).toBe('request');
		const droppedBefore = session.getDroppedMessages();

		main.sendFromContainer(createEnvironmentEnvelope({
			sessionId: session.sessionId,
			kind: 'request',
			name: 'parameter.compute',
			requestId: compute?.requestId ?? 'missing',
			payload: { ids: ['velocity'], dependencies: session.store.snapshot() }
		}));
		await drainMicrotasks();
		expect(session.getDroppedMessages()).toBe(droppedBefore + 1);
		expect(session.getDiagnostics().some((diagnostic) => diagnostic.code === 'env/invalid')).toBe(true);
		expect(session.store.get('velocity')).toBe(3);

		main.sendFromContainer(createEnvironmentEnvelope({
			sessionId: session.sessionId,
			kind: 'response',
			name: 'parameter.compute',
			requestId: compute?.requestId ?? 'missing',
			payload: { values: { velocity: 9 } }
		}));
		await drainMicrotasks();
		expect(session.store.get('velocity')).toBe(9);
	});

	test('staged compute also rejects a wrong-direction request and accepts the response', async () => {
		const { session } = makeReadySession();
		const result = session.reloadStart(makeEntry());
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const handle = result.handle;
		const replacement = makeRecordedPair();
		handle.adoptMain({ main: replacement.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });
		const compute = replacement.fromHost.filter((message) => message.name === 'parameter.compute').at(-1);
		expect(compute?.kind).toBe('request');
		const droppedBefore = session.getDroppedMessages();

		replacement.sendFromContainer(createEnvironmentEnvelope({
			sessionId: handle.sessionId,
			kind: 'request',
			name: 'parameter.compute',
			requestId: compute?.requestId ?? 'missing',
			payload: { ids: ['velocity'], dependencies: handle.stagedStore.snapshot() }
		}));
		await drainMicrotasks();
		expect(session.getDroppedMessages()).toBe(droppedBefore + 1);
		expect(handle.stagedStore.get('velocity')).toBe(3);

		replacement.sendFromContainer(createEnvironmentEnvelope({
			sessionId: handle.sessionId,
			kind: 'response',
			name: 'parameter.compute',
			requestId: compute?.requestId ?? 'missing',
			payload: { values: { velocity: 11 } }
		}));
		await drainMicrotasks();
		expect(handle.stagedStore.get('velocity')).toBe(11);
		handle.cancel();
	});
});
