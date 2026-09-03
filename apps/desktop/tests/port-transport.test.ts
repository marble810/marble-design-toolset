/**
 * Port transport tests (the Desktop EnvironmentTransport seam): point-to-point
 * delivery, close semantics, and the queued-handoff race (Host sends boot before the
 * container transport existed — platform queues until start()).
 */
import { describe, expect, test } from 'bun:test';
import { createEnvironmentEnvelope, type EnvironmentEnvelope } from 'tool-contract';
import { createPortTransport } from '../src/transport/port-transport.ts';
import { drainPorts, FakeMessageChannelMain, FakeRendererPort, transferToRenderer, type MessageListener } from './fakes/ports.ts';

function bootEnvelope(sessionId = 's1'): EnvironmentEnvelope {
	return createEnvironmentEnvelope({
		sessionId,
		kind: 'request',
		name: 'boot',
		requestId: 'boot-main',
		payload: {
			endpoint: 'main',
			parameters: { values: {}, revisions: {} },
			assets: { values: {} },
			surface: { kind: 'canvas', width: 640, height: 360 },
			inventory: { assets: [], exports: [] }
		}
	});
}

describe('createPortTransport', () => {
	test('delivers both directions after the one-time handoff', async () => {
		const channel = new FakeMessageChannelMain();
		const containerPort = transferToRenderer(channel.port1);
		const hostPort = transferToRenderer(channel.port2);
		const host = createPortTransport(hostPort as unknown as Parameters<typeof createPortTransport>[0]);
		const container = createPortTransport(containerPort as unknown as Parameters<typeof createPortTransport>[0]);

		const seenHost: EnvironmentEnvelope[] = [];
		const seenContainer: EnvironmentEnvelope[] = [];
		host.subscribe((message) => seenHost.push(message));
		container.subscribe((message) => seenContainer.push(message));

		container.send(bootEnvelope());
		host.send(createEnvironmentEnvelope({ sessionId: 's1', kind: 'event', name: 'surface.resize', payload: { width: 10, height: 20 } }));
		await drainPorts();

		expect(seenHost).toHaveLength(1);
		expect((seenHost[0].payload as { endpoint: string }).endpoint).toBe('main');
		expect(seenContainer).toHaveLength(1);
		expect((seenContainer[0].payload as { width: number }).width).toBe(10);
	});

	test('close stops delivery and closes the underlying port', async () => {
		const channel = new FakeMessageChannelMain();
		const containerPort = transferToRenderer(channel.port1);
		const hostPort = transferToRenderer(channel.port2);
		const host = createPortTransport(hostPort as unknown as Parameters<typeof createPortTransport>[0]);
		const container = createPortTransport(containerPort as unknown as Parameters<typeof createPortTransport>[0]);
		const seen: EnvironmentEnvelope[] = [];
		host.subscribe((message) => seen.push(message));

		container.send(bootEnvelope());
		await drainPorts();
		expect(seen).toHaveLength(1);

		host.close();
		container.send(bootEnvelope());
		await drainPorts();
		expect(seen).toHaveLength(1);
		expect((hostPort.logical as unknown as { closed: boolean }).closed).toBe(true);
	});

	test('messages posted before start() are queued by the platform and flushed in order', async () => {
		const channel = new FakeMessageChannelMain();
		const containerPort = transferToRenderer(channel.port1);
		const hostPort = transferToRenderer(channel.port2);
		// Container-side transport NOT created yet: the container page is still loading.
		const host = createPortTransport(hostPort as unknown as Parameters<typeof createPortTransport>[0]);

		// Direct MessagePort semantics: host posts two envelopes; the renderer port has
		// no listeners yet, so they queue until the container transport starts.
		const seen: EnvironmentEnvelope[] = [];
		host.send(bootEnvelope('s1'));
		host.send(createEnvironmentEnvelope({ sessionId: 's1', kind: 'event', name: 'surface.resize', payload: { width: 1, height: 2 } }));
		await drainPorts();
		expect(seen).toHaveLength(0);

		containerPort.addEventListener('message', ((event: { data: unknown }) => seen.push(event.data as EnvironmentEnvelope)) as MessageListener);
		containerPort.start();
		await drainPorts();

		expect(seen).toHaveLength(2);
		expect((seen[0].name as string)).toBe('boot');
		expect((seen[1].name as string)).toBe('surface.resize');
	});
});
