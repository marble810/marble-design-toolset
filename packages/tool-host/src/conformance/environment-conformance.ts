/**
 * Shared Environment API conformance suite. It exercises the full management-plane
 * protocol — a real Host `ToolSession` against a real container runtime
 * (`startToolContainer`) — over caller-provided transport pairs, so Web (iframe) and
 * Desktop (MessagePort) adapters prove the same semantics with only the transport
 * replaced. This module is a test utility: it links tool-host and tool-sdk and asserts
 * with node:assert; production code paths MUST NOT import it.
 *
 * Covered scenarios (tool-environment-api / tool-session-lifecycle requirements):
 *   1. boot → surface.ready → Ready + catch-up snapshot after Ready
 *   2. HostReady-phase Store update + Host-scheduled computed wave round trip
 *   3. Slate boots only after Main Ready and never blocks Canvas readiness;
 *      endpoint mismatch on the Slate channel is diagnosed and ignored
 *   4. parameter.set from a Container: accepted broadcast + typed rejections
 *   5. Tool Command lifecycle: result, unknown rejection, timeout → Unresponsive → Restart
 *   6. Stale sessionId messages and invalid envelopes are dropped with diagnostics
 *   7. Asset changed broadcast + asset.request answers (incl. empty fallback)
 *   8. export.execute → export.result with serializable content
 *   9. surface.resize reaches the addressed container only
 *  10. close() disposes both containers (surface.dispose) and stops message routing
 */
import assert from 'node:assert/strict';
import {
	catalogEntryId,
	createEnvironmentEnvelope,
	type AssetContent,
	type CatalogEntry,
	type Diagnostic,
	type EnvironmentEndpointRole,
	type EnvironmentEnvelope,
	type EnvironmentTransport,
	type ParameterSetResponsePayload,
	type ParameterValue,
	type ToolCommandDescriptor
} from 'tool-contract';
import { startToolContainer, type ToolContainerRuntimeHandle, type VisualToolDefinition } from 'tool-sdk';
import { ToolSession, type ToolSessionHealth, type ToolSessionState } from '../session.ts';

export interface ConformanceTransportPair {
	host: EnvironmentTransport;
	container: EnvironmentTransport;
}

export interface EnvironmentConformanceHarness {
	/** Creates one fresh transport pair (one per channel: main, slate, restart, …). */
	createPair(): ConformanceTransportPair;
	/**
	 * Starts the container runtime under test on the container end of `pair`. The suite
	 * supplies the (possibly mutated) recording definition; adapters wrap it with their
	 * own transport plumbing (iframe container transport, MessagePort, …).
	 */
	startContainer(input: {
		pair: ConformanceTransportPair;
		endpoint: EnvironmentEndpointRole;
		definition: VisualToolDefinition;
	}): ToolContainerRuntimeHandle;
	/** Drains queued transport deliveries + microtasks before assertions. */
	flush(): Promise<void>;
}

const PROJECT_ID = '8f2c1a0e-1111-4222-8333-444455556666';
const RUNTIME_CONFIG = {
	startupTimeoutMs: 500,
	commandTimeoutMs: 60,
	cancelGraceMs: 60,
	computeTimeoutMs: 500
} as const;

function conformanceEntry(): CatalogEntry {
	const source = { kind: 'web', sourceId: 'conformance' } as const;
	return {
		catalogEntryId: catalogEntryId(source, PROJECT_ID),
		source,
		projectId: PROJECT_ID,
		slug: 'conformance-tool',
		name: 'Conformance Tool',
		version: '1.0.0',
		forgeProfile: 'forge-v1',
		libraries: [],
		artifacts: { main: 'main.js' },
		parameters: {
			base: {
				id: 'base',
				type: 'number',
				label: 'Base',
				default: 1,
				mode: 'manual',
				constraint: { type: 'number', min: 0, max: 10, step: 1 }
			},
			double: {
				id: 'double',
				type: 'number',
				label: 'Double',
				default: 2,
				mode: 'computed',
				constraint: { type: 'number', min: 0, max: 100 },
				dependsOn: ['base']
			}
		},
		assets: {
			photo: { id: 'photo', kind: 'image', label: 'Photo' }
		},
		commands: {
			ping: { id: 'ping', label: 'Ping' } satisfies ToolCommandDescriptor
		},
		privateCallbacks: {},
		outputs: {
			snapshot: { id: 'snapshot', kind: 'image', label: 'Snapshot', mime: 'image/png' }
		},
		inspectorTree: { elements: [] },
		surfaces: { canvas: true, slate: true }
	};
}

interface RecordingDefinition {
	definition: VisualToolDefinition;
	recorded: {
		commands: string[];
		computeWaves: string[][];
		exports: string[];
	};
}

/** Recording Tool Entry definition shared by every container started in the suite. */
function createRecordingDefinition(): RecordingDefinition {
	const recorded = {
		commands: [] as string[],
		computeWaves: [] as string[][],
		exports: [] as string[]
	};
	const definition: VisualToolDefinition = {
		parameters: {
			base: {
				type: 'number',
				label: 'Base',
				default: 1,
				mode: 'manual',
				constraint: { type: 'number', min: 0, max: 10, step: 1 }
			},
			double: {
				type: 'number',
				label: 'Double',
				default: 2,
				mode: 'computed',
				constraint: { type: 'number', min: 0, max: 100 },
				dependsOn: ['base'],
				compute: (deps) => {
					recorded.computeWaves.push(['double']);
					return (deps.base as number) * 2;
				}
			}
		},
		commands: {
			ping: {
				label: 'Ping',
				run: () => {
					recorded.commands.push('ping');
				}
			}
		},
		privateCallbacks: {},
		outputs: {
			snapshot: {
				kind: 'image',
				label: 'Snapshot',
				mime: 'image/png',
				render: () => {
					recorded.exports.push('snapshot');
					return new Uint8Array([1, 2, 3]);
				}
			}
		},
		canvas: () => Promise.resolve(undefined)
	};
	return { definition, recorded };
}

async function tick(times = 2): Promise<void> {
	for (let i = 0; i < times; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

async function waitForState(session: ToolSession, state: ToolSessionState): Promise<void> {
	const deadline = Date.now() + 2_000;
	while (session.getState() !== state) {
		if (Date.now() > deadline) throw new Error(`session never reached '${state}' (now '${session.getState()}')`);
		await tick(1);
	}
}

async function waitForHealth(session: ToolSession, health: ToolSessionHealth): Promise<void> {
	const deadline = Date.now() + 2_000;
	while (session.getHealth() !== health) {
		if (Date.now() > deadline) throw new Error(`session health never became '${health}'`);
		await tick(1);
	}
}

async function waitForTruthy(read: () => boolean, label: string): Promise<void> {
	const deadline = Date.now() + 2_000;
	while (!read()) {
		if (Date.now() > deadline) throw new Error(`condition never became true: ${label}`);
		await tick(1);
	}
}

function createSession(overrides?: { assetResolver?: (assetId: string) => AssetContent | null }): ToolSession {
	return new ToolSession({
		entry: conformanceEntry(),
		runtimeConfig: RUNTIME_CONFIG,
		assetResolver:
			overrides?.assetResolver ??
			((assetId) => (assetId === 'photo' ? ({ kind: 'blob-url', mime: 'image/png', url: 'blob:conformance-photo' } satisfies AssetContent) : null))
	});
}

async function bootToReady(harness: EnvironmentConformanceHarness): Promise<{
	session: ToolSession;
	main: ToolContainerRuntimeHandle;
	pair: ConformanceTransportPair;
	recorded: RecordingDefinition['recorded'];
	definition: VisualToolDefinition;
}> {
	const pair = harness.createPair();
	const { definition, recorded } = createRecordingDefinition();
	const main = harness.startContainer({ pair, endpoint: 'main', definition });
	const session = createSession();
	session.boot({
		main: pair.host,
		surface: { kind: 'canvas', width: 320, height: 240 },
		inventory: { assets: ['photo'], exports: ['snapshot'] }
	});
	await main.ready;
	await waitForState(session, 'Ready');
	await harness.flush();
	return { session, main, pair, recorded, definition };
}

async function bootSlateContainer(
	harness: EnvironmentConformanceHarness,
	session: ToolSession,
	surface?: { width: number; height: number }
): Promise<{ slate: ToolContainerRuntimeHandle; slatePair: ConformanceTransportPair }> {
	const slatePair = harness.createPair();
	const { definition } = createRecordingDefinition();
	const slate = harness.startContainer({ pair: slatePair, endpoint: 'slate', definition });
	session.bootSlate({
		transport: slatePair.host,
		surface: { kind: 'slate', width: surface?.width ?? 200, height: surface?.height ?? 100 }
	});
	await slate.ready;
	await harness.flush();
	return { slate, slatePair };
}

/**
 * Runs the whole conformance battery. Throws on the first failed expectation.
 * Callers (Web/Desktop tests) wrap this in their own test runner.
 */
export async function runEnvironmentConformanceTests(harness: EnvironmentConformanceHarness): Promise<void> {
	// -- 1. boot → surface.ready → Ready + dispose on close ---------------------
	{
		const { session, main } = await bootToReady(harness);
		assert.equal(session.getState(), 'Ready');
		assert.equal(main.context.sessionId, session.sessionId);
		assert.deepEqual(main.context.surface(), { kind: 'canvas', width: 320, height: 240 });
		assert.equal(main.context.parameters.snapshot().values.base, 1);
		assert.equal(main.context.client.endpoint, 'main');
		session.close();
		await harness.flush();
		assert.equal(await main.disposed, 'surface-dispose');
	}

	// -- 2. HostReady-phase update + computed wave ------------------------------
	{
		const pair = harness.createPair();
		const { definition, recorded } = createRecordingDefinition();
		const main = harness.startContainer({ pair, endpoint: 'main', definition });
		const session = createSession();
		// HostReady phase: the Store accepts updates before any container exists.
		const revision = session.store.snapshot().revisions.base;
		const setResult = session.store.set('base', 3, revision);
		assert.equal(setResult.accepted, true);
		session.boot({ main: pair.host, surface: { kind: 'canvas', width: 100, height: 100 } });
		await main.ready;
		await waitForState(session, 'Ready');
		await harness.flush();
		// The compute wave ran in the Main container and the result committed.
		assert.deepEqual(recorded.computeWaves, [['double']]);
		assert.equal(session.store.get('double'), 6);
		// Container mirror received the catch-up snapshot with the latest values.
		assert.equal(main.context.parameters.snapshot().values.base, 3);
		assert.equal(main.context.parameters.snapshot().values.double, 6);
		session.close();
	}

	// -- 3. Slate after Ready; endpoint mismatch ignored -------------------------
	{
		const { session } = await bootToReady(harness);
		// Slate boot before Ready is rejected explicitly (a fresh session is HostReady).
		const fresh = createSession();
		const anyPair = harness.createPair();
		assert.throws(
			() => fresh.bootSlate({ transport: anyPair.host, surface: { kind: 'slate', width: 10, height: 10 } }),
			/Ready/
		);
		assert.equal(session.isSlateReady(), false);

		const diagnosticsBefore = session.getDiagnostics().length;
		const { slate, slatePair } = await bootSlateContainer(harness, session);
		assert.equal(session.isSlateReady(), true);
		assert.equal(session.getState(), 'Ready', 'slate readiness must not change session state');

		// Slate channel reporting a canvas ready is a mismatch: diagnostic + ignored.
		slatePair.container.send(
			createEnvironmentEnvelope({
				sessionId: session.sessionId,
				kind: 'event',
				name: 'surface.ready',
				payload: { endpoint: 'main', surface: 'canvas' }
			})
		);
		await harness.flush();
		assert.ok(
			session.getDiagnostics().slice(diagnosticsBefore).some((d) => d.code === 'session/endpoint-mismatch'),
			'endpoint mismatch must produce session/endpoint-mismatch'
		);
		assert.equal(session.isSlateReady(), true, 'a mismatched ready must not reset slate readiness');
		session.close();
		await harness.flush();
		void slate;
	}

	// -- 4. parameter.set from a Container (slate path) ---------------------------
	{
		const { session, main } = await bootToReady(harness);
		const { slate } = await bootSlateContainer(harness, session);

		const revision = slate.context.parameters.snapshot().revisions.base;
		const accepted = (await slate.context.setParameter('base', 4, revision)) as ParameterSetResponsePayload;
		await harness.flush();
		assert.equal(accepted.accepted, true);
		if (accepted.accepted) assert.equal(accepted.value, 4);
		// Broadcast reached the Main mirror and the Host Store.
		await waitForTruthy(() => main.context.parameters.snapshot().values.base === 4, 'main mirror updated');
		assert.equal(session.store.get('base'), 4);

		// Stale revision → typed rejection.
		const rejected = (await slate.context.setParameter('base', 5, revision)) as ParameterSetResponsePayload;
		assert.equal(rejected.accepted, false);
		if (!rejected.accepted) assert.equal(rejected.diagnostic.code, 'parameter/revision');

		// Computed parameters are never directly settable.
		const computed = (await slate.context.setParameter('double', 8, 0)) as ParameterSetResponsePayload;
		assert.equal(computed.accepted, false);
		if (!computed.accepted) assert.equal(computed.diagnostic.code, 'parameter/mode');
		session.close();
	}

	// -- 5. Tool Command lifecycle ------------------------------------------------
	{
		const { session, recorded, definition } = await bootToReady(harness);
		const result = session.executeCommand('ping');
		assert.equal(result.ok, true);
		await harness.flush();
		assert.deepEqual(recorded.commands, ['ping']);

		// Unknown command → typed rejection without a message.
		const unknown = session.executeCommand('nope');
		assert.equal(unknown.ok, false);
		if (!unknown.ok) assert.equal(unknown.diagnostic.code, 'command/unknown');
		session.close();

		// Timeout → cancel → Unresponsive → Restart on a fresh container.
		definition.commands!.ping.run = () => new Promise<void>(() => {});
		const hangPair = harness.createPair();
		const hang = harness.startContainer({ pair: hangPair, endpoint: 'main', definition });
		const session2 = createSession();
		session2.boot({ main: hangPair.host, surface: { kind: 'canvas', width: 10, height: 10 } });
		await hang.ready;
		await waitForState(session2, 'Ready');
		const invocation = session2.executeCommand('ping');
		assert.equal(invocation.ok, true);
		await waitForHealth(session2, 'Unresponsive');

		const restartPair = harness.createPair();
		const restarted = harness.startContainer({ pair: restartPair, endpoint: 'main', definition });
		const oldSessionId = session2.sessionId;
		session2.restart({ main: restartPair.host, surface: { kind: 'canvas', width: 10, height: 10 } });
		await restarted.ready;
		await waitForState(session2, 'Ready');
		assert.notEqual(session2.sessionId, oldSessionId);
		assert.equal(session2.getHealth(), 'Responsive');
		assert.equal(session2.store.get('base'), 1, 'restart resets the Store to defaults');
		session2.close();
	}

	// -- 6. stale sessionId + invalid envelope are dropped ------------------------
	{
		const { session, pair } = await bootToReady(harness);
		const beforeDrops = session.getDroppedMessages();
		const beforeDiags = session.getDiagnostics().length;
		pair.container.send(
			createEnvironmentEnvelope({
				sessionId: 'stale-session-id',
				kind: 'request',
				name: 'parameter.set',
				requestId: 'x',
				payload: { id: 'base', value: 9, expectedRevision: 0 }
			})
		);
		await harness.flush();
		assert.equal(session.getDroppedMessages(), beforeDrops + 1);
		assert.equal(session.store.get('base'), 1);
		pair.container.send({ garbage: true } as unknown as EnvironmentEnvelope);
		await harness.flush();
		assert.ok(
			session.getDiagnostics().slice(beforeDiags).some((d) => d.code === 'env/invalid'),
			'invalid envelope must produce env/invalid'
		);
		session.close();
	}

	// -- 7. Asset flow -------------------------------------------------------------
	{
		const { session, main } = await bootToReady(harness);
		const { slate } = await bootSlateContainer(harness, session);

		const content: AssetContent = { kind: 'blob-url', mime: 'image/png', url: 'blob:asset-1' };
		session.setAsset('photo', content);
		await harness.flush();
		assert.equal(main.context.assets.values().photo?.kind, 'blob-url');
		assert.equal(slate.context.assets.values().photo?.kind, 'blob-url');

		const requested = await main.context.requestAsset('photo');
		// The environment adapter (assetResolver) answers photo requests; unknown slots fall
		// back to the empty content.
		assert.deepEqual(requested, { kind: 'blob-url', mime: 'image/png', url: 'blob:conformance-photo' });
		const empty = await main.context.requestAsset('unknown-slot');
		assert.deepEqual(empty, { kind: 'empty' });
		session.close();
	}

	// -- 8. Export flow --------------------------------------------------------------
	{
		const { session, recorded } = await bootToReady(harness);
		const pending = session.executeExport('snapshot');
		await harness.flush();
		const result = await pending;
		assert.equal(result.ok, true);
		assert.equal(recorded.exports.length, 1);
		assert.equal(result.content?.kind, 'blob-url');
		if (result.content?.kind === 'blob-url') assert.equal(result.content.mime, 'image/png');

		const unknown = session.executeExport('nope');
		await assert.rejects(unknown, /unknown output/);
		session.close();
	}

	// -- 9. surface.resize reaches the addressed channel -----------------------------
	{
		const { session, main } = await bootToReady(harness);
		session.resizeSurface('main', { width: 800, height: 600 });
		await harness.flush();
		await waitForTruthy(() => main.context.surface().width === 800, 'main surface resized');
		assert.deepEqual(main.context.surface(), { kind: 'canvas', width: 800, height: 600 });

		const { slate } = await bootSlateContainer(harness, session, { width: 100, height: 100 });
		session.resizeSurface('slate', { width: 220, height: 120 });
		await harness.flush();
		await waitForTruthy(() => slate.context.surface().width === 220, 'slate surface resized');
		assert.equal(main.context.surface().width, 800, 'main surface unaffected by slate resize');
		session.close();
	}

	// -- 10. close disposes both containers ------------------------------------------
	{
		const { session, main, pair } = await bootToReady(harness);
		const { slate } = await bootSlateContainer(harness, session);
		session.close();
		assert.equal(session.getState(), 'Closed');
		assert.equal(await main.disposed, 'surface-dispose');
		assert.equal(await slate.disposed, 'surface-dispose');
		// After close the Session is detached from its transports: late messages simply
		// never reach it (real adapters close the channel), and state never changes.
		pair.container.send(
			createEnvironmentEnvelope({
				sessionId: session.sessionId,
				kind: 'event',
				name: 'surface.ready',
				payload: { endpoint: 'main', surface: 'canvas' }
			})
		);
		await harness.flush();
		assert.equal(session.getState(), 'Closed');
	}
}

/** Convenience: latest committed value of a parameter in a container mirror. */
export function containerParameterValue(handle: ToolContainerRuntimeHandle, id: string): ParameterValue | undefined {
	return handle.context.parameters.snapshot().values[id];
}
