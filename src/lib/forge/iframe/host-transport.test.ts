/**
 * Iframe transport tests over fake windows: strict source/origin filtering, queued
 * outbound delivery until the container document loads, and close semantics. The
 * message-flow protocol itself is covered by the shared Environment API conformance
 * suite (see src/lib/forge/web/conformance-web.test.ts).
 *
 * Fake window semantics mirror the DOM: `A.postMessage(m)` = a message arrives AT A
 * from its peer; `A.flush()` delivers A's queued events (source = A.linked).
 */
import { describe, expect, test } from 'bun:test';
import { createEnvironmentEnvelope, type EnvironmentEnvelope } from 'tool-contract';
import { createFakeWindowPair, FakeWindow } from './fake-window.js';
import { createIframeHostTransport, type IframeLike } from './host-transport.js';
import { createIframeContainerTransport } from './container-transport.js';

const ORIGIN = 'https://deshelf.test';

function makeIframe(contentWindow: unknown): IframeLike & { __fireLoad(): void } {
	const loadListeners = new Set<() => void>();
	return {
		contentWindow: contentWindow as IframeLike['contentWindow'],
		addEventListener(type: 'load', listener: () => void) {
			if (type === 'load') loadListeners.add(listener);
		},
		removeEventListener(type: 'load', listener: () => void) {
			if (type === 'load') loadListeners.delete(listener);
		},
		__fireLoad() {
			for (const listener of [...loadListeners]) listener();
		}
	};
}

function envelope(name: string, sessionId = 's1'): EnvironmentEnvelope {
	return createEnvironmentEnvelope({ sessionId, kind: 'event', name: name as never, payload: { reason: name } });
}

describe('createIframeHostTransport', () => {
	test('queues outbound envelopes until the iframe load event, then flushes in order', async () => {
		const { parent, container } = createFakeWindowPair(ORIGIN);
		const iframe = makeIframe(container);
		const transport = createIframeHostTransport({ iframe, listen: parent, origin: ORIGIN });
		transport.send(envelope('boot'));
		transport.send(envelope('parameter.snapshot'));
		// Host → container messages sit in the container's inbound queue… which the
		// transport does not touch until the container document has loaded.
		expect(container.queuedCount).toBe(0);
		iframe.__fireLoad();
		await transport.whenLoaded;
		await Promise.resolve(); // flush runs on a microtask
		expect(container.queuedCount).toBe(2);
		expect(container.lastTargetOrigin).toBe(ORIGIN);
		transport.send(envelope('surface.resize'));
		expect(container.queuedCount).toBe(3);
		transport.close();
	});

	test('delivers container messages to subscribers and rejects foreign sources/origins', async () => {
		const { parent, container } = createFakeWindowPair(ORIGIN);
		const iframe = makeIframe(container);
		const rejected: string[] = [];
		const transport = createIframeHostTransport({ iframe, listen: parent, origin: ORIGIN, onRejectedMessage: (r) => rejected.push(r) });
		const received: EnvironmentEnvelope[] = [];
		transport.subscribe((m) => received.push(m));

		// A message from a foreign source (not this iframe's contentWindow) is rejected.
		const foreign = new FakeWindow(ORIGIN);
		parent.deliverFrom(foreign, envelope('surface.ready'));
		parent.flush();
		expect(received.length).toBe(0);
		expect(rejected.length).toBe(1);

		// A message from a foreign origin is rejected.
		parent.deliverFrom(container, envelope('surface.ready'), 'https://evil.test');
		parent.flush();
		expect(received.length).toBe(0);
		expect(rejected.length).toBe(2);

		// The real container reports ready after its document loads.
		iframe.__fireLoad();
		parent.deliverFrom(container, envelope('surface.ready'));
		parent.flush();
		expect(received.length).toBe(1);
		transport.close();
	});

	test('close() stops delivery in both directions', async () => {
		const { parent, container } = createFakeWindowPair(ORIGIN);
		const iframe = makeIframe(container);
		const transport = createIframeHostTransport({ iframe, listen: parent, origin: ORIGIN });
		const received: EnvironmentEnvelope[] = [];
		transport.subscribe((m) => received.push(m));
		iframe.__fireLoad();
		transport.close();
		transport.send(envelope('boot'));
		expect(container.queuedCount).toBe(0);
		parent.deliverFrom(container, envelope('surface.ready'));
		parent.flush();
		expect(received.length).toBe(0);
	});
});

describe('createIframeContainerTransport', () => {
	test('sends to the parent and accepts only parent messages with the shared origin', () => {
		const { parent, container } = createFakeWindowPair(ORIGIN);
		const rejected: string[] = [];
		const transport = createIframeContainerTransport({ parent, listen: container, origin: ORIGIN, onRejectedMessage: (r) => rejected.push(r) });
		const received: EnvironmentEnvelope[] = [];
		transport.subscribe((m) => received.push(m));

		// Container → parent: the message arrives at the parent window's queue.
		transport.send(envelope('surface.ready'));
		expect(parent.queuedCount).toBe(1);
		expect(parent.lastTargetOrigin).toBe(ORIGIN);

		// Host → container: delivered with source === parent, so the transport accepts it.
		container.deliverFrom(parent, envelope('parameter.snapshot'));
		container.flush();
		expect(received.length).toBe(1);

		// A sibling iframe (source !== parent) is rejected.
		const sibling = new FakeWindow(ORIGIN);
		container.deliverFrom(sibling, envelope('surface.ready'));
		container.flush();
		expect(received.length).toBe(1);
		expect(rejected.length).toBe(1);

		transport.close();
		transport.send(envelope('surface.ready'));
		expect(parent.queuedCount).toBe(1); // nothing new posted after close
	});
});
