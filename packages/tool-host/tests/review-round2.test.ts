/**
 * Second-round review regressions:
 *   Blocker — after Reload commit the promoted Main channel must route all session
 *             messages (command result / parameter.set / compute response).
 *   Major 1 — Restart detaches the old Slate channel and allows a fresh Slate boot.
 *   Major 2 — Reload cancel/failure releases the whole staged runtime.
 *   Major 3 — Staged Slate command.result/export.result produce main-only diagnostics.
 *   Major 4 — HostReady computed waves stay dirty and retry after Main boot.
 */
import { describe, expect, test } from 'bun:test';
import { ToolSession } from '../src/index.ts';
import { createEnvironmentEnvelope, type EnvironmentEnvelope } from 'tool-contract';
import { makeEntry, makeRecordedPair, drainMicrotasks, ManualTimer, type RecordedPair } from './helpers.ts';

type Ctx = { session: ToolSession; timer: ManualTimer; main: RecordedPair };

function makeCtx(entry?: ReturnType<typeof makeEntry>): Ctx {
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

describe('review round 2: reload commit routing', () => {
	test('after commit the replacement Main channel routes command/param/compute round trips', async () => {
		const { session } = makeCtx();
		const result = session.reloadStart(makeEntry());
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const handle = result.handle;
		const replacement = makeRecordedPair();
		handle.adoptMain({ main: replacement.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });
		replacement.sendFromContainer(readyEnvelope(handle.sessionId, 'main', 'canvas'));
		expect(session.getState()).toBe('Ready');

		// command round trip: the result must release the single-flight slot
		const action = session.executeCommand('resimulate');
		expect(action.ok).toBe(true);
		const execute = replacement.fromHost.filter((m) => m.name === 'command.execute' && m.sessionId === session.sessionId).at(-1);
		expect(execute).toBeDefined();
		const invocationId = (execute?.payload as { invocationId: string }).invocationId;
		replacement.sendFromContainer(createEnvironmentEnvelope({
			sessionId: session.sessionId,
			kind: 'event',
			name: 'command.result',
			payload: { invocationId, ok: true }
		}));
		const again = session.executeCommand('resimulate');
		expect(again.ok).toBe(true); // single-flight released → the result was processed

		// parameter.set round trip through the promoted store
		replacement.sendFromContainer(createEnvironmentEnvelope({
			sessionId: session.sessionId,
			kind: 'request',
			name: 'parameter.set',
			requestId: 'r-100',
			payload: { id: 'speed', value: 5, expectedRevision: 1 } // migrated value sits at revision 1
		}));
		const setResponse = replacement.fromHost.find((m) => m.kind === 'response' && m.name === 'parameter.set' && m.requestId === 'r-100');
		expect(setResponse?.payload).toMatchObject({ accepted: true, id: 'speed', value: 5 });
		expect(session.store.get('speed')).toBe(5);

		// compute round trip over the promoted channel
		session.store.set('turbulence', 9, 1);
		const computeRequest = replacement.fromHost.filter((m) => m.name === 'parameter.compute').at(-1);
		expect(computeRequest).toBeDefined();
		replacement.sendFromContainer(createEnvironmentEnvelope({
			sessionId: session.sessionId,
			kind: 'response',
			name: 'parameter.compute',
			requestId: computeRequest?.requestId,
			payload: { values: { velocity: 45 } }
		}));
		await drainMicrotasks();
		expect(session.store.get('velocity')).toBe(45);
	});
});

describe('review round 2: restart slate cleanup', () => {
	test('restart detaches the old slate and allows a fresh slate boot', () => {
		const { session } = makeCtx();
		const oldSlate = makeRecordedPair();
		session.bootSlate({ transport: oldSlate.pair.host, surface: { kind: 'slate', width: 320, height: 480 } });
		oldSlate.sendFromContainer(readyEnvelope(session.sessionId, 'slate', 'slate'));
		expect(session.isSlateReady()).toBe(true);

		const fresh = makeRecordedPair();
		session.restart({ main: fresh.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });
		expect(session.isSlateReady()).toBe(false); // fresh session starts without a slate

		fresh.sendFromContainer(readyEnvelope(session.sessionId, 'main', 'canvas'));
		const newSlate = makeRecordedPair();
		// must not throw "slate already booted" — the old slate reference is gone
		session.bootSlate({ transport: newSlate.pair.host, surface: { kind: 'slate', width: 320, height: 480 } });
		expect(newSlate.fromHost[0]?.name).toBe('boot');

		// new-Session broadcasts go to the new slate only, never the detached old one
		session.store.set('speed', 5, 0);
		expect(oldSlate.fromHost.some((m) => m.name === 'parameter.changed')).toBe(false);
		expect(newSlate.fromHost.some((m) => m.name === 'parameter.changed')).toBe(true);

		newSlate.sendFromContainer(readyEnvelope(session.sessionId, 'slate', 'slate'));
		expect(session.isSlateReady()).toBe(true);
	});
});

describe('review round 2: reload release cleanup', () => {
	test('cancel releases the staged runtime: store closed, subscriptions/timers gone', () => {
		const { session, timer } = makeCtx();
		const result = session.reloadStart(makeEntry());
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const handle = result.handle;

		const replacement = makeRecordedPair();
		handle.adoptMain({ main: replacement.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });
		handle.adoptSlate({ transport: makeRecordedPair().pair.host, surface: { kind: 'slate', width: 320, height: 480 } });
		expect(handle.stagedStore.isClosed()).toBe(false);

		handle.cancel();

		expect(handle.disposed).toBe(true);
		expect(handle.stagedStore.isClosed()).toBe(true);
		expect(handle.stagedStore.set('speed', 1, 0).accepted).toBe(false); // store/closed
		expect(session.hasActiveReload()).toBe(false);
		// startup timer was cancelled: advancing produces no reload-failed diagnostic
		const diagCount = session.getDiagnostics().length;
		timer.advance(1000);
		expect(session.getDiagnostics().length).toBe(diagCount);
		// old Session untouched
		expect(session.getState()).toBe('Ready');
		expect(session.store.get('speed')).toBe(1);
	});

	test('failure releases the staged runtime too', () => {
		const { session, timer } = makeCtx();
		const result = session.reloadStart(makeEntry());
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const handle = result.handle;
		const replacement = makeRecordedPair();
		handle.adoptMain({ main: replacement.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });

		timer.advance(1000); // startup timeout
		expect(session.getDiagnostics().some((d) => d.code === 'session/reload-failed')).toBe(true);
		expect(handle.disposed).toBe(true);
		expect(handle.stagedStore.isClosed()).toBe(true);
		expect(session.getState()).toBe('Ready');
		expect(session.store.get('speed')).toBe(1);
	});
});

describe('review round 2: staged slate main-only messages', () => {
	test('staged slate command.result/export.result produce main-only diagnostics', () => {
		const { session } = makeCtx();
		const result = session.reloadStart(makeEntry());
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const handle = result.handle;
		const replacement = makeRecordedPair();
		handle.adoptMain({ main: replacement.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });
		const replacementSlate = makeRecordedPair();
		handle.adoptSlate({ transport: replacementSlate.pair.host, surface: { kind: 'slate', width: 320, height: 480 } });

		replacementSlate.sendFromContainer(createEnvironmentEnvelope({
			sessionId: handle.sessionId,
			kind: 'event',
			name: 'command.result',
			payload: { invocationId: 'inv-1', ok: true }
		}));
		replacementSlate.sendFromContainer(createEnvironmentEnvelope({
			sessionId: handle.sessionId,
			kind: 'event',
			name: 'export.result',
			payload: { invocationId: 'exp-1', ok: true }
		}));
		const mainOnly = session.getDiagnostics().filter((d) => d.code === 'session/main-only-message');
		expect(mainOnly.length).toBeGreaterThanOrEqual(2);
		expect(session.getDroppedMessages()).toBeGreaterThanOrEqual(2);
		handle.cancel();
	});
});

describe('review round 2: HostReady computed deferral', () => {
	test('computed waves stay dirty during HostReady and retry after Main boot', async () => {
		const timer = new ManualTimer();
		const session = new ToolSession({
			entry: makeEntry(),
			sessionId: 'session-1',
			runtimeConfig: { startupTimeoutMs: 1000, commandTimeoutMs: 1000, cancelGraceMs: 200, computeTimeoutMs: 500 },
			timer
		});
		expect(session.getState()).toBe('HostReady');

		// pre-boot dependency commit: the wave is deferred, not consumed
		const result = session.store.set('speed', 4, 0);
		expect(result.accepted).toBe(true);
		expect(session.store.get('velocity')).toBe(3); // untouched — no channel to compute on
		expect(session.getDiagnostics()).toHaveLength(0); // no compute-timeout noise

		const main = makeRecordedPair();
		session.boot({ main: main.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });
		expect(session.getState()).toBe('Booting');
		expect(main.fromHost[0]?.name).toBe('boot'); // boot always first

		// the deferred wave retries immediately after boot
		const computeRequest = main.fromHost.find((m) => m.name === 'parameter.compute');
		expect(computeRequest).toBeDefined();
		expect((computeRequest?.payload as { ids: string[] }).ids).toContain('velocity');

		main.sendFromContainer(createEnvironmentEnvelope({
			sessionId: session.sessionId,
			kind: 'response',
			name: 'parameter.compute',
			requestId: computeRequest?.requestId,
			payload: { values: { velocity: 12 } }
		}));
		await drainMicrotasks();
		expect(session.store.get('velocity')).toBe(12);

		// deferred waves never armed a compute timer: advancing only trips the startup
		// timeout, never a parameter/compute-* diagnostic
		timer.advance(1000);
		expect(session.getDiagnostics().some((d) => d.code.startsWith('parameter/compute'))).toBe(false);
		expect(session.getDiagnostics().some((d) => d.code === 'session/startup-timeout')).toBe(true);
	});
});