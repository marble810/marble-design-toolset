/**
 * Third-round review regressions:
 *   Major — Reload commit promotes a staged CommandRunner; the old runner (including
 *           its in-flight invocation timers) is disposed, so no stale command.cancel or
 *           Unresponsive marking can leak into the replacement.
 *   Major — The staged replacement serves asset.request from the migrated staged state
 *           (never the active map), synchronously, on the correct channel.
 *   Major — Async asset resolver completions are bound to the exact session/channel
 *           generation; restart/reload-commit/close suppress stale responses.
 *   Major — Slate startup timeout is terminal: a late surface.ready cannot revive it,
 *           the slate slot is freed, and Main stays Ready. Replacement Slate lifecycle
 *           inherits the same semantics after commit.
 *   Extra — export.execute → export.result round trip after Reload commit.
 */
import { describe, expect, test } from 'bun:test';
import { ReloadHandle, ToolSession } from '../src/index.ts';
import { createEnvironmentEnvelope, type AssetContent, type EnvironmentEnvelope } from 'tool-contract';
import { makeEntry, makeRecordedPair, drainMicrotasks, ManualTimer, type RecordedPair } from './helpers.ts';

type Ctx = { session: ToolSession; timer: ManualTimer; main: RecordedPair };

function makeCtx(entry?: ReturnType<typeof makeEntry>, overrides?: { assetResolver?: (id: string) => AssetContent | null | Promise<AssetContent | null> }): Ctx {
	const timer = new ManualTimer();
	const session = new ToolSession({
		entry: entry ?? makeEntry(),
		sessionId: 'session-1',
		runtimeConfig: { startupTimeoutMs: 1000, commandTimeoutMs: 1000, cancelGraceMs: 200, computeTimeoutMs: 500 },
		timer,
		...overrides
	});
	const main = makeRecordedPair();
	session.boot({ main: main.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });
	main.sendFromContainer(readyEnvelope(session.sessionId, 'main', 'canvas'));
	return { session, timer, main };
}

function readyEnvelope(sessionId: string, endpoint: 'main' | 'slate', surface: 'canvas' | 'slate'): EnvironmentEnvelope {
	return createEnvironmentEnvelope({ sessionId, kind: 'event', name: 'surface.ready', payload: { endpoint, surface } });
}

function assetRequest(sessionId: string, requestId: string, assetId: string): EnvironmentEnvelope {
	return createEnvironmentEnvelope({ sessionId, kind: 'request', name: 'asset.request', requestId, payload: { assetId } });
}

function commitReplacement(session: ToolSession, handle: ReloadHandle): RecordedPair {
	const replacement = makeRecordedPair();
	handle.adoptMain({ main: replacement.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });
	replacement.sendFromContainer(readyEnvelope(handle.sessionId, 'main', 'canvas'));
	expect(session.getState()).toBe('Ready');
	return replacement;
}

function reloadHandle(session: ToolSession) {
	const result = session.reloadStart(makeEntry());
	expect(result.ok).toBe(true);
	if (!result.ok) throw new Error('reloadStart failed');
	return result.handle;
}

const blob: AssetContent = { kind: 'blob-url', mime: 'image/png', url: 'blob:abc' };

// ---------------------------------------------------------------------------
// 1. Reload commit: old CommandRunner teardown + staged runner promotion
// ---------------------------------------------------------------------------

describe('reload commit runner promotion', () => {
	test('old in-flight command timers cannot cancel or mark the replacement', () => {
		const { session, timer, main } = makeCtx();
		// Active command starts and arms its 1000ms timeout on the OLD runner.
		const action = session.executeCommand('resimulate');
		expect(action.ok).toBe(true);
		const execute = main.fromHost.filter((m) => m.name === 'command.execute').at(-1);
		expect(execute).toBeDefined();

		const handle = reloadHandle(session);
		const replacement = commitReplacement(session, handle);

		// The old invocation's timeout + grace window elapses after commit: nothing
		// may be sent to the promoted channel and health must stay Responsive.
		timer.advance(1000);
		expect(replacement.fromHost.filter((m) => m.name === 'command.cancel' && m.sessionId === session.sessionId)).toHaveLength(0);
		expect(session.getHealth()).toBe('Responsive');
		timer.advance(200);
		expect(session.getHealth()).toBe('Responsive');
		expect(replacement.fromHost.filter((m) => m.name === 'command.cancel')).toHaveLength(0);
	});

	test('committed inspector actions and status use the promoted runner', () => {
		const { session } = makeCtx();
		const handle = reloadHandle(session);
		const replacement = commitReplacement(session, handle);

		const triggered = session.inspector.trigger('resimulateButton');
		expect(triggered.ok).toBe(true);
		const execute = replacement.fromHost.filter((m) => m.name === 'command.execute' && m.sessionId === session.sessionId).at(-1);
		expect(execute).toBeDefined();
		const invocationId = (execute?.payload as { invocationId: string }).invocationId;
		expect(session.inspector.getNodeState('resimulateButton')?.running).toBe(true);

		replacement.sendFromContainer(
			createEnvironmentEnvelope({ sessionId: session.sessionId, kind: 'event', name: 'command.result', payload: { invocationId, ok: true } })
		);
		expect(session.inspector.getNodeState('resimulateButton')?.running).toBe(false);
		// single-flight slot released on the promoted runner
		expect(session.inspector.trigger('resimulateButton').ok).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 2. Staged replacement asset.request
// ---------------------------------------------------------------------------

describe('staged replacement asset requests', () => {
	test('replacement Main receives migrated content and empty answers from staged state', () => {
		const entry = makeEntry();
		const { session } = makeCtx(entry);
		session.setAsset('heightMap', blob);

		const newEntry = makeEntry();
		newEntry.assets = {
			heightMap: { id: 'heightMap', kind: 'image', label: 'Height Map' },
			mask: { id: 'mask', kind: 'data', label: 'Mask' }
		};
		const result = session.reloadStart(newEntry);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const handle = result.handle;
		const replacement = makeRecordedPair();
		handle.adoptMain({ main: replacement.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });

		replacement.sendFromContainer(assetRequest(handle.sessionId, 'a-1', 'heightMap'));
		replacement.sendFromContainer(assetRequest(handle.sessionId, 'a-2', 'mask'));
		replacement.sendFromContainer(assetRequest(handle.sessionId, 'a-3', 'removedSlot'));

		const responses = replacement.fromHost.filter((m) => m.name === 'asset.request' && m.kind === 'response');
		const migrated = responses.find((m) => m.requestId === 'a-1');
		const emptyNew = responses.find((m) => m.requestId === 'a-2');
		const emptyRemoved = responses.find((m) => m.requestId === 'a-3');
		expect(migrated?.payload).toMatchObject({ assetId: 'heightMap', content: blob });
		expect((emptyNew?.payload as { content: AssetContent }).content.kind).toBe('empty');
		expect((emptyRemoved?.payload as { content: AssetContent }).content.kind).toBe('empty');
		handle.cancel();
	});

	test('replacement Slate asset.request also answers from staged state', () => {
		const { session } = makeCtx(makeEntry());
		session.setAsset('heightMap', blob);
		const handle = reloadHandle(session);
		const replacement = makeRecordedPair();
		handle.adoptMain({ main: replacement.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });
		const replacementSlate = makeRecordedPair();
		handle.adoptSlate({ transport: replacementSlate.pair.host, surface: { kind: 'slate', width: 320, height: 480 } });

		replacementSlate.sendFromContainer(assetRequest(handle.sessionId, 'a-s1', 'heightMap'));
		const response = replacementSlate.fromHost.find((m) => m.name === 'asset.request' && m.kind === 'response' && m.requestId === 'a-s1');
		expect(response?.payload).toMatchObject({ assetId: 'heightMap', content: blob });
		handle.cancel();
	});

	test('cancel releases the staged router: later requests get no response', () => {
		const { session } = makeCtx(makeEntry());
		session.setAsset('heightMap', blob);
		const handle = reloadHandle(session);
		const replacement = makeRecordedPair();
		handle.adoptMain({ main: replacement.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });

		replacement.sendFromContainer(assetRequest(handle.sessionId, 'a-1', 'heightMap'));
		expect(replacement.fromHost.filter((m) => m.name === 'asset.request' && m.kind === 'response').length).toBeGreaterThanOrEqual(1);

		handle.cancel();
		const before = replacement.fromHost.filter((m) => m.name === 'asset.request' && m.kind === 'response').length;
		replacement.sendFromContainer(assetRequest(handle.sessionId, 'a-2', 'heightMap'));
		// subscription is detached: nothing new reaches the host routing
		expect(replacement.fromHost.filter((m) => m.name === 'asset.request' && m.kind === 'response').length).toBe(before);
	});

	test('post-commit asset.request serves the migrated state through the session router', async () => {
		const { session } = makeCtx(makeEntry());
		session.setAsset('heightMap', blob);
		const handle = reloadHandle(session);
		const replacement = commitReplacement(session, handle);

		replacement.sendFromContainer(assetRequest(session.sessionId, 'a-9', 'heightMap'));
		await drainMicrotasks();
		const response = replacement.fromHost.find((m) => m.name === 'asset.request' && m.kind === 'response' && m.requestId === 'a-9');
		expect(response?.payload).toMatchObject({ assetId: 'heightMap', content: blob });
	});
});

// ---------------------------------------------------------------------------
// 3. Async asset resolver generation binding
// ---------------------------------------------------------------------------

describe('async asset resolver generation binding', () => {
	function makeDeferredResolver(): { resolver: (id: string) => Promise<AssetContent | null>; resolve: (c: AssetContent | null) => void } {
		let resolveFn: ((c: AssetContent | null) => void) | null = null;
		const resolver = (): Promise<AssetContent | null> => new Promise((resolve) => { resolveFn = resolve; });
		return {
			resolver,
			resolve: (content) => { resolveFn?.(content); }
		};
	}

	test('positive control: resolver completion answers the requesting session', async () => {
		const deferred = makeDeferredResolver();
		const { session, main } = makeCtx(makeEntry(), { assetResolver: deferred.resolver });
		main.sendFromContainer(assetRequest(session.sessionId, 'a-1', 'heightMap'));
		deferred.resolve(blob);
		await drainMicrotasks();
		const response = main.fromHost.find((m) => m.name === 'asset.request' && m.kind === 'response' && m.requestId === 'a-1');
		expect(response?.payload).toMatchObject({ assetId: 'heightMap', content: blob });
	});

	test('restart suppresses the stale completion on both old and new transports', async () => {
		const deferred = makeDeferredResolver();
		const { session, main } = makeCtx(makeEntry(), { assetResolver: deferred.resolver });
		main.sendFromContainer(assetRequest(session.sessionId, 'a-1', 'heightMap'));

		const fresh = makeRecordedPair();
		session.restart({ main: fresh.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });
		deferred.resolve(blob);
		await drainMicrotasks();

		expect(main.fromHost.filter((m) => m.name === 'asset.request' && m.kind === 'response' && m.requestId === 'a-1')).toHaveLength(0);
		expect(fresh.fromHost.filter((m) => m.name === 'asset.request')).toHaveLength(0);
	});

	test('reload commit suppresses the stale completion', async () => {
		const deferred = makeDeferredResolver();
		const { session, main } = makeCtx(makeEntry(), { assetResolver: deferred.resolver });
		main.sendFromContainer(assetRequest(session.sessionId, 'a-1', 'heightMap'));

		const handle = reloadHandle(session);
		const replacement = commitReplacement(session, handle);
		deferred.resolve(blob);
		await drainMicrotasks();

		expect(main.fromHost.filter((m) => m.name === 'asset.request' && m.kind === 'response' && m.requestId === 'a-1')).toHaveLength(0);
		expect(replacement.fromHost.filter((m) => m.name === 'asset.request' && m.kind === 'response' && m.requestId === 'a-1')).toHaveLength(0);
	});

	test('close suppresses the stale completion', async () => {
		const deferred = makeDeferredResolver();
		const { session, main } = makeCtx(makeEntry(), { assetResolver: deferred.resolver });
		main.sendFromContainer(assetRequest(session.sessionId, 'a-1', 'heightMap'));

		session.close();
		deferred.resolve(blob);
		await drainMicrotasks();

		expect(main.fromHost.filter((m) => m.name === 'asset.request' && m.kind === 'response' && m.requestId === 'a-1')).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// 4. Slate timeout is terminal
// ---------------------------------------------------------------------------

describe('slate timeout terminal semantics', () => {
	test('late ready cannot revive a timed-out slate; a fresh slate can boot', () => {
		const { session, timer } = makeCtx();
		const slate = makeRecordedPair();
		session.bootSlate({ transport: slate.pair.host, surface: { kind: 'slate', width: 320, height: 480 } });

		timer.advance(1000);
		expect(session.getDiagnostics().some((d) => d.code === 'session/slate-timeout')).toBe(true);
		expect(session.isSlateReady()).toBe(false);
		expect(session.getState()).toBe('Ready'); // Main unaffected

		// Late ready on the timed-out generation (subscription detached + router guard)
		slate.sendFromContainer(readyEnvelope(session.sessionId, 'slate', 'slate'));
		expect(session.isSlateReady()).toBe(false);

		// The slate slot is free: a fresh slate boots and can become ready
		const freshSlate = makeRecordedPair();
		session.bootSlate({ transport: freshSlate.pair.host, surface: { kind: 'slate', width: 320, height: 480 } });
		expect(freshSlate.fromHost[0]?.name).toBe('boot');
		freshSlate.sendFromContainer(readyEnvelope(session.sessionId, 'slate', 'slate'));
		expect(session.isSlateReady()).toBe(true);
	});

	test('replacement slate inherits terminal timeout after commit', () => {
		const { session, timer } = makeCtx();
		const handle = reloadHandle(session);
		const replacement = makeRecordedPair();
		handle.adoptMain({ main: replacement.pair.host, surface: { kind: 'canvas', width: 800, height: 600 } });
		const replacementSlate = makeRecordedPair();
		handle.adoptSlate({ transport: replacementSlate.pair.host, surface: { kind: 'slate', width: 320, height: 480 } });
		replacement.sendFromContainer(readyEnvelope(handle.sessionId, 'main', 'canvas'));

		expect(session.getState()).toBe('Ready');
		expect(replacementSlate.fromHost.some((m) => m.name === 'boot')).toBe(true); // booted post-commit
		timer.advance(1000);
		expect(session.getDiagnostics().some((d) => d.code === 'session/slate-timeout')).toBe(true);
		expect(session.isSlateReady()).toBe(false);
		expect(session.getState()).toBe('Ready');

		replacementSlate.sendFromContainer(readyEnvelope(session.sessionId, 'slate', 'slate'));
		expect(session.isSlateReady()).toBe(false); // timed-out generation is terminal
	});
});

// ---------------------------------------------------------------------------
// 5. Export round trip after commit
// ---------------------------------------------------------------------------

describe('export after reload commit', () => {
	test('export.execute → export.result round trips over the promoted channel', async () => {
		const { session } = makeCtx();
		const handle = reloadHandle(session);
		const replacement = commitReplacement(session, handle);

		const promise = session.executeExport('still');
		const execute = replacement.fromHost.filter((m) => m.name === 'export.execute' && m.sessionId === session.sessionId).at(-1);
		expect(execute).toBeDefined();
		const invocationId = (execute?.payload as { invocationId: string }).invocationId;

		replacement.sendFromContainer(
			createEnvironmentEnvelope({ sessionId: session.sessionId, kind: 'event', name: 'export.result', payload: { invocationId, ok: true } })
		);
		const outcome = await promise;
		expect(outcome.ok).toBe(true);
	});
});