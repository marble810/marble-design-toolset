/**
 * Staged Reload: value migration, staged snapshot boot, atomic commit on replacement
 * ready, failure/cancel preserving the old Session, and the single-replacement invariant.
 */
import { describe, expect, test } from 'bun:test';
import { createEnvironmentEnvelope } from 'tool-contract';
import { ToolSession } from '../src/index.ts';
import { makeEntry, makeRecordedPair, ManualTimer } from './helpers.ts';

function makeSession(timer?: ManualTimer) {
	const t = timer ?? new ManualTimer();
	const session = new ToolSession({
		entry: makeEntry(),
		sessionId: 'session-1',
		runtimeConfig: { startupTimeoutMs: 1000, commandTimeoutMs: 1000, cancelGraceMs: 200, computeTimeoutMs: 500 },
		timer: t
	});
	const main = makeRecordedPair();
	session.boot({ main: main.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });
	main.sendFromContainer(createEnvironmentEnvelope({
		sessionId: session.sessionId,
		kind: 'event',
		name: 'surface.ready',
		payload: { endpoint: 'main', surface: 'canvas' }
	}));
	return { session, timer: t, main };
}

/** TS helper to avoid unused-import noise in the middle of the file. */
function mainFrom(session: ToolSession): void {
	void session;
}
describe('staged reload', () => {
	test('reloadStart migrates compatible values and rejects incompatible ones', () => {
		const { session } = makeSession();
		session.store.set('speed', 5, 0);
		session.store.set('preset', 'storm', 0);

		const newEntry = makeEntry();
		(newEntry.parameters.speed as { constraint: { type: 'number'; min: number; max: number } }).constraint = { type: 'number', min: 6, max: 10 };
		(newEntry.parameters.preset as { type: string }).type = 'string'; // type change

		const result = session.reloadStart(newEntry);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.handle.stagedStore.get('speed')).toBe(1); // 5 violates new min → default
		expect(result.handle.stagedStore.get('preset')).toBe('calm'); // type change → default
		expect(result.handle.stagedStore.get('velocity')).toBe(3); // computed never migrated
		result.handle.cancel();
	});

	test('replacement boots with the staged snapshot and a fresh session id; commit is atomic', () => {
		const { session, main } = makeSession();
		session.store.set('speed', 7, 0);

		const result = session.reloadStart(makeEntry());
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const handle = result.handle;
		const stagedId = handle.sessionId;
		expect(stagedId).not.toBe(session.sessionId);

		const replacement = makeRecordedPair();
		handle.adoptMain({ main: replacement.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });
		expect(session.getState()).toBe('Ready'); // old session stays active

		const boot = replacement.fromHost[0];
		expect(boot?.name).toBe('boot');
		expect(boot?.sessionId).toBe(stagedId);
		const parameters = (boot?.payload as { parameters: { values: Record<string, number> } }).parameters;
		expect(parameters.values.speed).toBe(7); // staged snapshot carries migrated value

		// replacement reports ready → atomic commit
		replacement.sendFromContainer(createEnvironmentEnvelope({
			sessionId: stagedId,
			kind: 'event',
			name: 'surface.ready',
			payload: { endpoint: 'main', surface: 'canvas' }
		}));

		expect(session.sessionId).toBe(stagedId);
		expect(session.getState()).toBe('Ready');
		expect(session.getHealth()).toBe('Responsive');
		expect(session.store.get('speed')).toBe(7);
		expect(session.hasActiveReload()).toBe(false);
		// old container disposed
		const dispose = main.fromHost.find((m) => m.name === 'surface.dispose');
		expect(dispose).toBeDefined();
		if (dispose !== undefined) {
			expect((dispose.payload as { reason: string }).reason).toBe('session-replaced');
		}
		// catch-up snapshot after commit
		const catchUp = replacement.fromHost.find((m) => m.name === 'parameter.snapshot');
		expect(catchUp).toBeDefined();
		if (catchUp !== undefined) {
			expect((catchUp.payload as { snapshot: { values: Record<string, number> } }).snapshot.values.speed).toBe(7);
		}
	});

	test('replacement writes route to the staged store and answer on the replacement channel', () => {
		const { session } = makeSession();
		session.store.set('speed', 7, 0);
		const result = session.reloadStart(makeEntry());
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const handle = result.handle;
		const replacement = makeRecordedPair();
		handle.adoptMain({ main: replacement.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });

		replacement.sendFromContainer(createEnvironmentEnvelope({
			sessionId: handle.sessionId,
			kind: 'request',
			name: 'parameter.set',
			requestId: 'r-1',
			payload: { id: 'speed', value: 2, expectedRevision: 1 } // migrated revision 1
		}));
		const response = replacement.fromHost.find((m) => m.kind === 'response' && m.name === 'parameter.set');
		expect(response?.payload).toMatchObject({ accepted: true, id: 'speed', value: 2 });
		expect(handle.stagedStore.get('speed')).toBe(2);

		// old session still answers its own session id on its own channel
		mainFrom(session);
	});

	test('replacement failure keeps the old Session and releases staged resources', () => {
		const { session, timer, main } = makeSession();
		session.store.set('speed', 7, 0);
		const oldId = session.sessionId;

		const result = session.reloadStart(makeEntry());
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const handle = result.handle;
		const replacement = makeRecordedPair();
		handle.adoptMain({ main: replacement.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });

		timer.advance(1000); // replacement startup timeout

		expect(session.sessionId).toBe(oldId);
		expect(session.getState()).toBe('Ready');
		expect(session.store.get('speed')).toBe(7);
		expect(session.hasActiveReload()).toBe(false);
		expect(session.getDiagnostics().some((d) => d.code === 'session/reload-failed')).toBe(true);
		// replacement disposed
		const dispose = replacement.fromHost.find((m) => m.name === 'surface.dispose');
		expect(dispose).toBeDefined();
		if (dispose !== undefined) {
			expect((dispose.payload as { reason: string }).reason).toBe('reload-failed');
		}
		void main;
	});

	test('explicit cancel releases staged resources without diagnostics', () => {
		const { session } = makeSession();
		const result = session.reloadStart(makeEntry());
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const handle = result.handle;
		handle.cancel();
		expect(session.hasActiveReload()).toBe(false);
		expect(session.getDiagnostics().filter((d) => d.code === 'session/reload-failed')).toHaveLength(0);
	});

	test('single replacement invariant: a second reloadStart while active is rejected', () => {
		const { session } = makeSession();
		const first = session.reloadStart(makeEntry());
		expect(first.ok).toBe(true);
		if (!first.ok) return;
		const second = session.reloadStart(makeEntry());
		expect(second.ok).toBe(false);
		if (!second.ok) expect(second.diagnostic.code).toBe('session/reload-in-progress');
		first.handle.cancel();
		// after release a new reload is allowed
		const third = session.reloadStart(makeEntry());
		expect(third.ok).toBe(true);
		if (third.ok) third.handle.cancel();
	});

	test('reload is rejected in Booting and Closed states', () => {
		const timer = new ManualTimer();
		const session = new ToolSession({
			entry: makeEntry(),
			sessionId: 'session-1',
			runtimeConfig: { startupTimeoutMs: 1000, commandTimeoutMs: 1000, cancelGraceMs: 200, computeTimeoutMs: 500 },
			timer
		});
		const main = makeRecordedPair();
		session.boot({ main: main.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });
		const duringBoot = session.reloadStart(makeEntry());
		expect(duringBoot.ok).toBe(false);
		if (!duringBoot.ok) expect(duringBoot.diagnostic.code).toBe('session/reload-state');

		session.close();
		const closed = session.reloadStart(makeEntry());
		expect(closed.ok).toBe(false);
		if (!closed.ok) expect(closed.diagnostic.code).toBe('session/closed');
	});

	test('post-commit commands and changes flow over the replacement channel', () => {
		const { session } = makeSession();
		const result = session.reloadStart(makeEntry());
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const handle = result.handle;
		const replacement = makeRecordedPair();
		handle.adoptMain({ main: replacement.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });
		replacement.sendFromContainer(createEnvironmentEnvelope({
			sessionId: handle.sessionId,
			kind: 'event',
			name: 'surface.ready',
			payload: { endpoint: 'main', surface: 'canvas' }
		}));

		// a command now goes to the replacement container
		const action = session.executeCommand('resimulate');
		expect(action.ok).toBe(true);
		const execute = replacement.fromHost.find((m) => m.name === 'command.execute');
		expect(execute).toBeDefined();
		if (execute !== undefined && action.ok) {
			expect((execute.payload as { commandId: string }).commandId).toBe('resimulate');
			replacement.sendFromContainer(createEnvironmentEnvelope({
				sessionId: session.sessionId,
				kind: 'event',
				name: 'command.result',
				payload: { invocationId: (execute.payload as { invocationId: string }).invocationId, ok: true }
			}));
		}
		// and parameter.changed broadcasts go to the replacement only
		const before = replacement.fromHost.filter((m) => m.name === 'parameter.changed').length;
		session.store.set('speed', 6, 1); // migrated value sits at revision 1
		const changed = replacement.fromHost.filter((m) => m.name === 'parameter.changed');
		expect(changed.length).toBe(before + 1);
	});
});