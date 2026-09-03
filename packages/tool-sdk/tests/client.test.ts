/**
 * EnvironmentClient: request/response correlation, event routing, session stamping and
 * dispose semantics over an in-memory transport pair.
 */
import { describe, expect, test } from 'bun:test';
import { createInMemoryTransportPair, createEnvironmentEnvelope, type EnvironmentEnvelope } from 'tool-contract';
import { EnvironmentClient } from '../src/index.ts';

function makeClient() {
	const pair = createInMemoryTransportPair();
	const hostSeen: EnvironmentEnvelope[] = [];
	pair.host.subscribe((message) => hostSeen.push(message));
	const client = new EnvironmentClient(pair.container, { sessionId: 'session-1', endpoint: 'slate', timeoutMs: 50 });
	return { pair, client, hostSeen };
}

describe('EnvironmentClient', () => {
	test('request resolves with the correlated response payload', async () => {
		const { pair, client } = makeClient();
		const envelopePromise = new Promise<EnvironmentEnvelope>((resolve) => {
			pair.host.subscribe((message) => resolve(message));
		});
		const promise = client.request('asset.request', { assetId: 'heightMap' });
		const envelope = await envelopePromise;
		expect(envelope.kind).toBe('request');
		expect(envelope.name).toBe('asset.request');
		expect(envelope.sessionId).toBe('session-1');
		expect(envelope.protocolVersion).toBe(1);
		expect(envelope.requestId).toBeDefined();

		pair.host.send(
			createEnvironmentEnvelope({
				sessionId: 'session-1',
				kind: 'response',
				name: 'asset.request',
				requestId: envelope.requestId,
				payload: { assetId: 'heightMap', content: { kind: 'blob-url', mime: 'image/png', url: 'blob:1' } }
			})
		);
		const payload = await promise;
		expect(payload).toEqual({ assetId: 'heightMap', content: { kind: 'blob-url', mime: 'image/png', url: 'blob:1' } });
	});

	test('unmatched or stale responses are ignored; request times out', async () => {
		const { pair, client } = makeClient();
		const promise = client.request('asset.request', { assetId: 'a' }, { timeoutMs: 20 });
		pair.host.send(
			createEnvironmentEnvelope({
				sessionId: 'session-1',
				kind: 'response',
				name: 'asset.request',
				requestId: 'r-999',
				payload: { assetId: 'a', content: { kind: 'empty' } }
			})
		);
		await expect(promise).rejects.toThrow('environment-request-timeout');
	});

	test('respond answers a peer request echoing the requestId', async () => {
		const { pair, client, hostSeen } = makeClient();
		pair.host.send(
			createEnvironmentEnvelope({
				sessionId: 'session-1',
				kind: 'request',
				name: 'parameter.set',
				requestId: 'r-7',
				payload: { id: 'speed', value: 3, expectedRevision: 0 }
			})
		);
		client.respond('r-7', 'parameter.set', { accepted: true, id: 'speed', value: 3, revision: 1 });
		const envelope = hostSeen[0];
		expect(envelope).toBeDefined();
		expect(envelope.kind).toBe('response');
		expect(envelope.requestId).toBe('r-7');
		expect(envelope.name).toBe('parameter.set');
	});

	test('on() routes events and requests; unsubscribe stops routing', () => {
		const { pair, client } = makeClient();
		const received: string[] = [];
		const unsubscribe = client.on('parameter.changed', (payload) => {
			received.push((payload as { id: string }).id);
		});
		pair.host.send(
			createEnvironmentEnvelope({ sessionId: 'session-1', kind: 'event', name: 'parameter.changed', payload: { id: 'a', value: 1, revision: 1 } })
		);
		unsubscribe();
		pair.host.send(
			createEnvironmentEnvelope({ sessionId: 'session-1', kind: 'event', name: 'parameter.changed', payload: { id: 'b', value: 2, revision: 2 } })
		);
		expect(received).toEqual(['a']);
	});

	test('emit stamps sessionId and never carries a requestId', () => {
		const { pair, client, hostSeen } = makeClient();
		client.emit('surface.ready', { endpoint: 'slate', surface: 'slate' });
		expect(hostSeen).toHaveLength(1);
		expect(hostSeen[0]).toMatchObject({ sessionId: 'session-1', kind: 'event', name: 'surface.ready' });
		expect(hostSeen[0]?.requestId).toBeUndefined();
	});

	test('messages from other sessions are dropped with onInvalidMessage', () => {
		const pair = createInMemoryTransportPair();
		const reasons: string[] = [];
		const client = new EnvironmentClient(pair.container, {
			sessionId: 'session-1',
			endpoint: 'main',
			onInvalidMessage: (reason) => reasons.push(reason)
		});
		pair.host.send(
			createEnvironmentEnvelope({ sessionId: 'old-session', kind: 'event', name: 'parameter.changed', payload: { id: 'a', value: 1, revision: 1 } })
		);
		pair.host.send(
			createEnvironmentEnvelope({ sessionId: 'session-1', kind: 'event', name: 'parameter.changed', payload: { id: 'a', value: 99, revision: 99 } })
		);
		expect(reasons).toEqual(['session-mismatch']);
		client.dispose();
	});

	test('dispose rejects pending requests and stops delivery', async () => {
		const { pair, client } = makeClient();
		const promise = client.request('asset.request', { assetId: 'a' });
		client.dispose();
		await expect(promise).rejects.toThrow('environment-client-disposed');
		pair.host.send(
			createEnvironmentEnvelope({ sessionId: 'session-1', kind: 'event', name: 'parameter.changed', payload: { id: 'a', value: 1, revision: 1 } })
		);
		expect(client.request('asset.request', { assetId: 'a' })).rejects.toThrow('environment-client-disposed');
	});
});