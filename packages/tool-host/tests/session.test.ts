/**
 * Tool Session lifecycle core: Cataloged → HostReady → Booting → Ready | Failed → Closed,
 * Ready health, slate independence, pre-ready Store updates + post-ready snapshot
 * catch-up, old-session message filtering and Restart.
 */
import { describe, expect, test } from 'bun:test';
import { createEnvironmentEnvelope, type EnvironmentEnvelope } from 'tool-contract';
import { ToolSession } from '../src/index.ts';
import { makeEntry, makeRecordedPair, ManualTimer, drainMicrotasks } from './helpers.ts';

function makeSession(options?: { timer?: ManualTimer; entry?: ReturnType<typeof makeEntry> }) {
	const timer = options?.timer ?? new ManualTimer();
	const recorder = makeRecordedPair();
	const session = new ToolSession({
		entry: options?.entry ?? makeEntry(),
		sessionId: 'session-1',
		runtimeConfig: { startupTimeoutMs: 1000, commandTimeoutMs: 1000, cancelGraceMs: 200, computeTimeoutMs: 500 },
		timer
	});
	return { session, timer, recorder };
}

function bootToReady(session: ToolSession, recorder: ReturnType<typeof makeRecordedPair>) {
	session.boot({ main: recorder.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });
	recorder.sendFromContainer(createEnvironmentEnvelope({
		sessionId: session.sessionId,
		kind: 'event',
		name: 'surface.ready',
		payload: { endpoint: 'main', surface: 'canvas' }
	}));
}

describe('session lifecycle', () => {
	test('construction moves Cataloged → HostReady with Store + Inspector ready', () => {
		const { session } = makeSession();
		expect(session.getState()).toBe('HostReady');
		expect(session.store.get('speed')).toBe(1);
		expect(session.inspector.viewModel().elements.length).toBeGreaterThan(0);
	});

	test('boot sends a valid boot request and enters Booting', () => {
		const { session, recorder } = makeSession();
		session.boot({ main: recorder.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });
		expect(session.getState()).toBe('Booting');
		const boot = recorder.fromHost[0];
		expect(boot).toBeDefined();
		expect(boot.name).toBe('boot');
		expect(boot.kind).toBe('request');
		expect(boot.sessionId).toBe('session-1');
		expect((boot.payload as { endpoint: string }).endpoint).toBe('main');
		expect((boot.payload as { surface: { kind: string } }).surface.kind).toBe('canvas');
	});

	test('canvas surface.ready moves Booting → Ready and sends the catch-up snapshot', () => {
		const { session, recorder } = makeSession();
		session.boot({ main: recorder.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });

		// Store updates BEFORE ready are legal (inspector edits during HostReady/Booting).
		session.store.set('speed', 7, 0);
		recorder.sendFromContainer(createEnvironmentEnvelope({
			sessionId: session.sessionId,
			kind: 'event',
			name: 'surface.ready',
			payload: { endpoint: 'main', surface: 'canvas' }
		}));

		expect(session.getState()).toBe('Ready');
		expect(session.getHealth()).toBe('Responsive');
		// catch-up snapshot carries the pre-ready update
		const snapshot = recorder.fromHost.find((m) => m.name === 'parameter.snapshot');
		expect(snapshot).toBeDefined();
		const payload = snapshot?.payload as { snapshot: { values: Record<string, number> } };
		expect(payload.snapshot.values.speed).toBe(7);
	});

	test('startup timeout moves Booting → Failed with a diagnostic; container is retained', () => {
		const { session, timer, recorder } = makeSession();
		session.boot({ main: recorder.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });
		timer.advance(1000);
		expect(session.getState()).toBe('Failed');
		expect(session.getDiagnostics().some((d) => d.code === 'session/startup-timeout')).toBe(true);
	});

	test('close from Ready moves to Closed and disposes containers', () => {
		const { session, recorder } = makeSession();
		bootToReady(session, recorder);
		session.close();
		expect(session.getState()).toBe('Closed');
		const dispose = recorder.fromHost.filter((m) => m.name === 'surface.dispose');
		expect(dispose.length).toBe(1);
		expect((dispose[0]?.payload as { reason: string }).reason).toBe('session-closed');
		// store rejects writes after close
		expect(session.store.set('speed', 1, 0).accepted).toBe(false);
	});

	test('second boot is a programming error (throws)', () => {
		const { session, recorder } = makeSession();
		session.boot({ main: recorder.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });
		expect(() => session.boot({ main: recorder.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } })).toThrow(/boot-state/);
	});
});

describe('slate lifecycle', () => {
	test('slate boot requires Main Ready; it never blocks Main Ready and only boots after', () => {
		const { session, recorder } = makeSession();
		const slate = makeRecordedPair();
		session.boot({ main: recorder.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });

		// Slate must not boot before Main is Ready: rejected, no envelope sent.
		expect(() => session.bootSlate({ transport: slate.pair.host, surface: { kind: 'slate', width: 320, height: 480 } })).toThrow(/slate-boot/);
		expect(slate.fromHost).toHaveLength(0);
		expect(session.getState()).toBe('Booting');
		expect(session.isSlateReady()).toBe(false);

		recorder.sendFromContainer(createEnvironmentEnvelope({
			sessionId: session.sessionId,
			kind: 'event',
			name: 'surface.ready',
			payload: { endpoint: 'main', surface: 'canvas' }
		}));

		// After Main Ready the app may boot the Slate; readiness still needs slate surface.ready.
		session.bootSlate({ transport: slate.pair.host, surface: { kind: 'slate', width: 320, height: 480 } });
		expect(session.getState()).toBe('Ready');
		expect(slate.fromHost[0]).toBeDefined();
		expect(slate.fromHost[0]?.name).toBe('boot');
		expect((slate.fromHost[0]?.payload as { endpoint: string }).endpoint).toBe('slate');
		expect(session.isSlateReady()).toBe(false); // not ready until slate surface.ready

		slate.sendFromContainer(createEnvironmentEnvelope({
			sessionId: session.sessionId,
			kind: 'event',
			name: 'surface.ready',
			payload: { endpoint: 'slate', surface: 'slate' }
		}));
		expect(session.isSlateReady()).toBe(true);
		expect(session.getState()).toBe('Ready');
	});

	test('slate loading failure only emits a diagnostic; Main stays Ready', () => {
		const { session, recorder, timer } = makeSession();
		const slate = makeRecordedPair();
		session.boot({ main: recorder.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });
		recorder.sendFromContainer(createEnvironmentEnvelope({
			sessionId: session.sessionId,
			kind: 'event',
			name: 'surface.ready',
			payload: { endpoint: 'main', surface: 'canvas' }
		}));
		session.bootSlate({ transport: slate.pair.host, surface: { kind: 'slate', width: 320, height: 480 } });
		expect(slate.fromHost.filter((m) => m.name === 'boot')).toHaveLength(1); // timeout starts at actual boot
		timer.advance(1000); // slate never reports ready
		expect(session.getState()).toBe('Ready');
		expect(session.getDiagnostics().some((d) => d.code === 'session/slate-timeout')).toBe(true);
	});

	test('slate channel reporting a canvas ready is rejected with endpoint-mismatch', () => {
		const { session, recorder } = makeSession();
		const slate = makeRecordedPair();
		session.boot({ main: recorder.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });
		recorder.sendFromContainer(createEnvironmentEnvelope({
			sessionId: session.sessionId,
			kind: 'event',
			name: 'surface.ready',
			payload: { endpoint: 'main', surface: 'canvas' }
		}));
		session.bootSlate({ transport: slate.pair.host, surface: { kind: 'slate', width: 320, height: 480 } });
		slate.sendFromContainer(createEnvironmentEnvelope({
			sessionId: session.sessionId,
			kind: 'event',
			name: 'surface.ready',
			payload: { endpoint: 'main', surface: 'canvas' }
		}));
		expect(session.getDiagnostics().some((d) => d.code === 'session/endpoint-mismatch')).toBe(true);
		expect(session.isSlateReady()).toBe(false);
	});
});

describe('envelope routing', () => {
	test('parameter.set from a container commits via the Store and answers with a typed response', () => {
		const { session, recorder } = makeSession();
		bootToReady(session, recorder);
		recorder.sendFromContainer(createEnvironmentEnvelope({
			sessionId: session.sessionId,
			kind: 'request',
			name: 'parameter.set',
			requestId: 'r-1',
			payload: { id: 'speed', value: 6, expectedRevision: 0 }
		}));
		expect(session.store.get('speed')).toBe(6);
		const response = recorder.fromHost.find((m) => m.kind === 'response' && m.name === 'parameter.set');
		expect(response?.requestId).toBe('r-1');
		expect(response?.payload).toEqual({ accepted: true, id: 'speed', value: 6, revision: 1 });
		// changed broadcast to the container
		const changed = recorder.fromHost.find((m) => m.name === 'parameter.changed');
		expect(changed?.payload).toEqual({ id: 'speed', value: 6, revision: 1 });
	});

	test('rejected parameter.set produces a typed rejection response', () => {
		const { session, recorder } = makeSession();
		bootToReady(session, recorder);
		recorder.sendFromContainer(createEnvironmentEnvelope({
			sessionId: session.sessionId,
			kind: 'request',
			name: 'parameter.set',
			requestId: 'r-2',
			payload: { id: 'speed', value: 999, expectedRevision: 0 }
		}));
		const response = recorder.fromHost.find((m) => m.kind === 'response' && m.name === 'parameter.set');
		expect(response?.payload).toMatchObject({ accepted: false, id: 'speed' });
		if (response && !(response.payload as { accepted: boolean }).accepted) {
			expect((response.payload as { diagnostic: { code: string } }).diagnostic.code).toBe('parameter/constraint');
		}
	});

	test('computed scheduling crosses the seam: compute request → response commits', async () => {
		const { session, recorder } = makeSession();
		bootToReady(session, recorder);
		session.store.set('speed', 4, 0);
		const computeRequest = recorder.fromHost.find((m) => m.name === 'parameter.compute');
		expect(computeRequest).toBeDefined();
		const ids = (computeRequest?.payload as { ids: string[] }).ids;
		expect(ids).toContain('velocity');

		// container answers with the computed values
		recorder.sendFromContainer(createEnvironmentEnvelope({
			sessionId: session.sessionId,
			kind: 'response',
			name: 'parameter.compute',
			requestId: computeRequest?.requestId,
			payload: { values: { velocity: 12 } }
		}));
		await drainMicrotasks();
		expect(session.store.get('velocity')).toBe(12);
		expect(recorder.fromHost.some((m) => m.name === 'parameter.changed' && (m.payload as { id: string }).id === 'velocity')).toBe(true);
	});

	test('revision-stale parameter.set is rejected', () => {
		const { session, recorder } = makeSession();
		bootToReady(session, recorder);
		recorder.sendFromContainer(createEnvironmentEnvelope({
			sessionId: session.sessionId,
			kind: 'request',
			name: 'parameter.set',
			requestId: 'r-3',
			payload: { id: 'speed', value: 5, expectedRevision: 0 }
		}));
		recorder.sendFromContainer(createEnvironmentEnvelope({
			sessionId: session.sessionId,
			kind: 'request',
			name: 'parameter.set',
			requestId: 'r-4',
			payload: { id: 'speed', value: 4, expectedRevision: 0 } // stale now
		}));
		const stale = recorder.fromHost.filter((m) => m.name === 'parameter.set').find((m) => m.requestId === 'r-4');
		expect(stale?.payload).toMatchObject({ accepted: false });
		if (stale && !(stale.payload as { accepted: boolean }).accepted) {
			expect((stale.payload as { diagnostic: { code: string } }).diagnostic.code).toBe('parameter/revision');
		}
	});

	test('old-session messages are dropped without state change', () => {
		const { session, recorder } = makeSession();
		bootToReady(session, recorder);
		recorder.sendFromContainer(createEnvironmentEnvelope({
			sessionId: 'old-session-id',
			kind: 'event',
			name: 'surface.ready',
			payload: { endpoint: 'main', surface: 'canvas' }
		}));
		const dropped = session.getDroppedMessages();
		expect(dropped).toBeGreaterThan(0);
		expect(session.getState()).toBe('Ready');
	});

	test('invalid envelopes are dropped with a diagnostic', () => {
		const { session, recorder } = makeSession();
		bootToReady(session, recorder);
		recorder.sendFromContainer({
			sessionId: session.sessionId,
			kind: 'event',
			name: 'surface.ready',
			payload: { endpoint: 'main' }
		} as unknown as EnvironmentEnvelope);
		expect(session.getDiagnostics().some((d) => d.code === 'env/invalid')).toBe(true);
	});

	test('diagnostic.emit is recorded and forwarded', () => {
		const { session, recorder } = makeSession();
		bootToReady(session, recorder);
		recorder.sendFromContainer(createEnvironmentEnvelope({
			sessionId: session.sessionId,
			kind: 'event',
			name: 'diagnostic.emit',
			payload: { diagnostic: { severity: 'warning', code: 'tool/warn', message: 'watch out' } }
		}));
		expect(session.getDiagnostics().some((d) => d.code === 'tool/warn')).toBe(true);
	});

	test('asset.request is answered through the resolver', async () => {
		const { session, recorder } = makeSession();
		session.setAsset('heightMap', { kind: 'blob-url', mime: 'image/png', url: 'blob:abc' });
		bootToReady(session, recorder);
		recorder.sendFromContainer(createEnvironmentEnvelope({
			sessionId: session.sessionId,
			kind: 'request',
			name: 'asset.request',
			requestId: 'r-9',
			payload: { assetId: 'heightMap' }
		}));
		await drainMicrotasks();
		const response = recorder.fromHost.find((m) => m.requestId === 'r-9');
		expect(response?.payload).toEqual({
			assetId: 'heightMap',
			content: { kind: 'blob-url', mime: 'image/png', url: 'blob:abc' }
		});
	});
});

describe('restart and reset', () => {
	test('restart creates a new session id with fresh defaults and reboots', () => {
		const { session, recorder, timer } = makeSession();
		bootToReady(session, recorder);
		session.store.set('speed', 9, 0);
		const oldId = session.sessionId;

		const fresh = makeRecordedPair();
		session.restart({ main: fresh.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });

		expect(session.sessionId).not.toBe(oldId);
		expect(session.getState()).toBe('Booting');
		expect(session.store.get('speed')).toBe(1); // fresh defaults
		const boot = fresh.fromHost[0];
		expect(boot?.sessionId).toBe(session.sessionId);
		// old container got a best-effort dispose
		expect(recorder.fromHost.some((m) => m.name === 'surface.dispose' && (m.payload as { reason: string }).reason === 'session-restarted')).toBe(true);

		fresh.sendFromContainer(createEnvironmentEnvelope({
			sessionId: session.sessionId,
			kind: 'event',
			name: 'surface.ready',
			payload: { endpoint: 'main', surface: 'canvas' }
		}));
		expect(session.getState()).toBe('Ready');
		timer.advance(10000);
		expect(session.getState()).toBe('Ready');
	});

	test('restart is rejected from Booting', () => {
		const { session, recorder } = makeSession();
		session.boot({ main: recorder.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });
		expect(() => session.restart({ main: recorder.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } })).toThrow(/restart-state/);
	});

	test('resetDefaults restores defaults and broadcasts changes; container untouched', () => {
		const { session, recorder } = makeSession();
		bootToReady(session, recorder);
		session.store.set('speed', 9, 0);
		const before = recorder.fromHost.filter((m) => m.name === 'parameter.changed').length;
		const results = session.resetDefaults();
		expect(results.some((r) => r.accepted)).toBe(true);
		expect(session.store.get('speed')).toBe(1);
		const changed = recorder.fromHost.filter((m) => m.name === 'parameter.changed');
		expect(changed.length).toBeGreaterThan(before);
		expect(recorder.fromHost.some((m) => m.name === 'surface.dispose')).toBe(false);
	});
});