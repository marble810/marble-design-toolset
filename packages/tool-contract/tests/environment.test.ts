/**
 * Environment API contract test vectors: every message family accepted + rejected shape,
 * envelope rules (protocolVersion/sessionId/kind/name/requestId) and the transport pair.
 */
import { describe, expect, test } from 'bun:test';
import {
	createEnvironmentEnvelope,
	createInMemoryTransportPair,
	ENVIRONMENT_MESSAGE_NAMES,
	ENVIRONMENT_PROTOCOL_VERSION,
	recordTransport,
	validateEnvironmentEnvelope,
	validateEnvironmentPayload,
	type EnvironmentEnvelope,
	type EnvironmentMessageKind,
	type EnvironmentMessageName
} from '../src/index.ts';

const sessionId = 'session-1';

function envelope(kind: EnvironmentMessageKind, name: EnvironmentMessageName, payload: unknown, requestId?: string): EnvironmentEnvelope {
	return createEnvironmentEnvelope({ sessionId, kind, name, payload, ...(requestId !== undefined ? { requestId } : {}) });
}

const snapshot = {
	revision: 3,
	values: { speed: 2.5, enabled: true, preset: 'calm' },
	revisions: { speed: 1, enabled: 2, preset: 0 }
};

describe('environment envelope rules', () => {
	test('valid boot request passes', () => {
		const env = envelope('request', 'boot', {
			endpoint: 'main',
			parameters: snapshot,
			assets: { values: { heightMap: null } },
			surface: { kind: 'canvas', width: 800, height: 600 },
			inventory: { assets: ['heightMap'], exports: ['still'] }
		});
		expect(validateEnvironmentEnvelope(env).ok).toBe(true);
	});

	test('valid surface.ready event passes without requestId', () => {
		const env = envelope('event', 'surface.ready', { endpoint: 'main', surface: 'canvas' });
		expect(validateEnvironmentEnvelope(env).ok).toBe(true);
	});

	test('every message name has at least one supported kind', () => {
		for (const name of ENVIRONMENT_MESSAGE_NAMES) {
			let supported = 0;
			for (const kind of ['request', 'response', 'event'] as const) {
				if (validateEnvironmentPayload(name, kind, minimalPayload(name)).ok) supported += 1;
			}
			expect(supported).toBeGreaterThan(0);
		}
	});

	test('unsupported protocolVersion is rejected', () => {
		const env = { ...envelope('event', 'surface.ready', { endpoint: 'main', surface: 'canvas' }), protocolVersion: 2 };
		const result = validateEnvironmentEnvelope(env);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.diagnostics[0]?.code).toBe('env/protocol-version');
	});

	test('empty sessionId is rejected', () => {
		const env = createEnvironmentEnvelope({ sessionId: '', kind: 'event', name: 'surface.ready', payload: { endpoint: 'main', surface: 'canvas' } });
		const result = validateEnvironmentEnvelope(env);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.diagnostics.some((d) => d.code === 'env/session-id')).toBe(true);
	});

	test('unknown name is rejected', () => {
		const result = validateEnvironmentEnvelope(envelope('event', 'no.such.message' as EnvironmentMessageName, {}));
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.diagnostics[0]?.code).toBe('env/name');
	});

	test('requestId is forbidden on events', () => {
		const result = validateEnvironmentEnvelope(envelope('event', 'surface.ready', { endpoint: 'main', surface: 'canvas' }, 'r1'));
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.diagnostics.some((d) => d.code === 'env/request-id')).toBe(true);
	});

	test('requestId is required on responses', () => {
		const result = validateEnvironmentEnvelope(envelope('response', 'parameter.set', { accepted: true, id: 'speed', value: 1, revision: 2 }));
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.diagnostics.some((d) => d.code === 'env/request-id')).toBe(true);
	});

	test('name+kind combination is validated', () => {
		// parameter.changed is an event, not a request
		const result = validateEnvironmentEnvelope(envelope('request', 'parameter.changed', { id: 'speed', value: 1, revision: 2 }, 'r1'));
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.diagnostics.some((d) => d.code === 'env/message-kind')).toBe(true);
	});

	test('payload shape is validated per name', () => {
		// parameter.set expects { id, value, expectedRevision }
		const result = validateEnvironmentEnvelope(envelope('request', 'parameter.set', { id: 'speed', value: 'fast' }, 'r1'));
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.diagnostics.some((d) => d.code === 'env/payload')).toBe(true);
	});
});

describe('message family vectors', () => {
	test('parameter.snapshot request + response', () => {
		expect(validateEnvironmentEnvelope(envelope('request', 'parameter.snapshot', { snapshot }, 'r1')).ok).toBe(true);
		expect(validateEnvironmentEnvelope(envelope('response', 'parameter.snapshot', { ok: true }, 'r1')).ok).toBe(true);
	});

	test('parameter.changed event', () => {
		expect(validateEnvironmentEnvelope(envelope('event', 'parameter.changed', { id: 'speed', value: 3, revision: 4 })).ok).toBe(true);
	});

	test('parameter.set accepted + rejected responses', () => {
		const req = envelope('request', 'parameter.set', { id: 'speed', value: 3, expectedRevision: 2 }, 'r1');
		expect(validateEnvironmentEnvelope(req).ok).toBe(true);
		const accepted = envelope('response', 'parameter.set', { accepted: true, id: 'speed', value: 3, revision: 3 }, 'r1');
		expect(validateEnvironmentEnvelope(accepted).ok).toBe(true);
		const rejected = envelope('response', 'parameter.set', {
			accepted: false,
			id: 'speed',
			diagnostic: { severity: 'error', code: 'parameter/revision', message: 'stale revision' }
		}, 'r1');
		expect(validateEnvironmentEnvelope(rejected).ok).toBe(true);
	});

	test('parameter.compute request + response with diagnostics', () => {
		const req = envelope('request', 'parameter.compute', { ids: ['velocity'], dependencies: snapshot }, 'r2');
		expect(validateEnvironmentEnvelope(req).ok).toBe(true);
		const res = envelope('response', 'parameter.compute', {
			values: { velocity: 8 },
			diagnostics: [{ severity: 'warning', code: 'parameter/compute-invalid', message: 'clamped' }]
		}, 'r2');
		expect(validateEnvironmentEnvelope(res).ok).toBe(true);
	});

	test('command execute/cancel/result', () => {
		expect(validateEnvironmentEnvelope(envelope('request', 'command.execute', { commandId: 'restart', invocationId: 'inv-1' }, 'r1')).ok).toBe(true);
		expect(validateEnvironmentEnvelope(envelope('request', 'command.cancel', { invocationId: 'inv-1' }, 'r1')).ok).toBe(true);
		expect(validateEnvironmentEnvelope(envelope('event', 'command.result', { invocationId: 'inv-1', ok: true })).ok).toBe(true);
		const failed = envelope('event', 'command.result', {
			invocationId: 'inv-1',
			ok: false,
			error: { severity: 'error', code: 'command/error', message: 'boom' }
		});
		expect(validateEnvironmentEnvelope(failed).ok).toBe(true);
	});

	test('asset request/response/changed with all content shapes', () => {
		expect(validateEnvironmentEnvelope(envelope('request', 'asset.request', { assetId: 'heightMap' }, 'r1')).ok).toBe(true);
		const blob = envelope('response', 'asset.request', { assetId: 'heightMap', content: { kind: 'blob-url', mime: 'image/png', url: 'blob:origin/uuid' } }, 'r1');
		expect(validateEnvironmentEnvelope(blob).ok).toBe(true);
		const opaque = envelope('event', 'asset.changed', { assetId: 'heightMap', content: { kind: 'opaque', mime: 'image/png', handle: 'h-42' } });
		expect(validateEnvironmentEnvelope(opaque).ok).toBe(true);
		const empty = envelope('event', 'asset.changed', { assetId: 'heightMap', content: { kind: 'empty' } });
		expect(validateEnvironmentEnvelope(empty).ok).toBe(true);
	});

	test('export execute/result', () => {
		expect(validateEnvironmentEnvelope(envelope('request', 'export.execute', { outputId: 'still', invocationId: 'inv-2' }, 'r1')).ok).toBe(true);
		expect(validateEnvironmentEnvelope(envelope('event', 'export.result', { invocationId: 'inv-2', ok: true })).ok).toBe(true);
	});

	test('diagnostic.emit', () => {
		const env = envelope('event', 'diagnostic.emit', {
			diagnostic: { severity: 'warning', code: 'surface/slate', message: 'slate failed to load', path: 'surfaces.slate' }
		});
		expect(validateEnvironmentEnvelope(env).ok).toBe(true);
	});

	test('surface resize/dispose', () => {
		expect(validateEnvironmentEnvelope(envelope('event', 'surface.resize', { width: 900, height: 700 })).ok).toBe(true);
		expect(validateEnvironmentEnvelope(envelope('event', 'surface.dispose', { reason: 'session-closed' })).ok).toBe(true);
	});

	test('non-finite numbers and NaN values are rejected', () => {
		const bad1 = validateEnvironmentEnvelope(envelope('event', 'surface.resize', { width: NaN, height: 600 }));
		expect(bad1.ok).toBe(false);
		const bad2 = validateEnvironmentEnvelope(envelope('request', 'parameter.set', { id: 'speed', value: Infinity, expectedRevision: 0 }, 'r1'));
		expect(bad2.ok).toBe(false);
	});
});

describe('in-memory transport pair', () => {
	test('messages flow from host end to container end and back', () => {
		const pair = createInMemoryTransportPair();
		const containerSide = recordTransport(pair.container);
		const hostSide = recordTransport(pair.host);

		const boot = envelope('request', 'boot', {
			endpoint: 'main',
			parameters: { revision: 0, values: {}, revisions: {} },
			assets: { values: {} },
			surface: { kind: 'canvas', width: 800, height: 600 },
			inventory: { assets: [], exports: [] }
		});
		pair.host.send(boot);
		expect(containerSide.messages).toHaveLength(1);
		expect(containerSide.messages[0]?.name).toBe('boot');

		const ready = envelope('event', 'surface.ready', { endpoint: 'main', surface: 'canvas' });
		pair.container.send(ready);
		expect(hostSide.messages).toHaveLength(1);
		expect(hostSide.messages[0]?.name).toBe('surface.ready');
	});

	test('close stops delivery and unsubscribes work', () => {
		const pair = createInMemoryTransportPair();
		const seen: string[] = [];
		const unsubscribe = pair.host.subscribe(() => seen.push('x'));
		pair.container.send(envelope('event', 'surface.ready', { endpoint: 'main', surface: 'canvas' }));
		unsubscribe();
		pair.container.send(envelope('event', 'diagnostic.emit', { diagnostic: { severity: 'error', code: 'x', message: 'y' } }));
		expect(seen).toEqual(['x']);
		pair.container.close();
		expect(() => pair.container.send(envelope('event', 'surface.ready', { endpoint: 'main', surface: 'canvas' }))).not.toThrow();
	});
});

/** A valid minimal payload per message name (only for kind coverage counting). */
function minimalPayload(name: EnvironmentMessageName): unknown {
	switch (name) {
		case 'boot':
			return {
				endpoint: 'main',
				parameters: { revision: 0, values: {}, revisions: {} },
				assets: { values: {} },
				surface: { kind: 'canvas', width: 1, height: 1 },
				inventory: { assets: [], exports: [] }
			};
		case 'surface.ready':
			return { endpoint: 'main', surface: 'canvas' };
		case 'surface.resize':
			return { width: 1, height: 1 };
		case 'surface.dispose':
			return { reason: 'close' };
		case 'parameter.snapshot':
			return { snapshot: { revision: 0, values: {}, revisions: {} } };
		case 'parameter.changed':
			return { id: 'a', value: 1, revision: 1 };
		case 'parameter.set':
			return { id: 'a', value: 1, expectedRevision: 0 };
		case 'parameter.compute':
			return { ids: ['a'], dependencies: { revision: 0, values: {}, revisions: {} } };
		case 'command.execute':
			return { commandId: 'c', invocationId: 'i' };
		case 'command.cancel':
			return { invocationId: 'i' };
		case 'command.result':
			return { invocationId: 'i', ok: true };
		case 'asset.request':
			return { assetId: 'a' };
		case 'asset.changed':
			return { assetId: 'a', content: { kind: 'empty' } };
		case 'export.execute':
			return { outputId: 'o', invocationId: 'i' };
		case 'export.result':
			return { invocationId: 'i', ok: true };
		case 'diagnostic.emit':
			return { diagnostic: { severity: 'error', code: 'c', message: 'm' } };
	}
}

void ENVIRONMENT_PROTOCOL_VERSION;