/**
 * surface.resize routing: the Host chrome resizes one Surface; the event reaches only
 * the addressed channel. Covers the resize surface added for the Web/Desktop container
 * adapters (resize never carries pixels or rendering state).
 */
import { describe, expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { createInMemoryTransportPair, recordTransport } from 'tool-contract';
import { ToolSession } from '../src/session.ts';
import { makeEntry } from './helpers.ts';

function readySession(): { session: ToolSession; main: ReturnType<typeof recordTransport>; slate: ReturnType<typeof recordTransport> } {
	const pair = createInMemoryTransportPair();
	const slatePair = createInMemoryTransportPair();
	// Record the container ends: host→container messages (boot, resize, dispose) are
	// delivered there, while container→host messages reach pair.host.
	const main = recordTransport(pair.container);
	const slate = recordTransport(slatePair.container);
	const session = new ToolSession({ entry: makeEntry() });
	session.boot({ main: pair.host, surface: { kind: 'canvas', width: 320, height: 240 } });
	// Simulate Main readiness: a valid canvas surface.ready.
	pair.container.send({
		protocolVersion: 1,
		sessionId: session.sessionId,
		kind: 'event',
		name: 'surface.ready',
		payload: { endpoint: 'main', surface: 'canvas' }
	} as never);
	session.bootSlate({ transport: slatePair.host, surface: { kind: 'slate', width: 100, height: 80 } });
	slatePair.container.send({
		protocolVersion: 1,
		sessionId: session.sessionId,
		kind: 'event',
		name: 'surface.ready',
		payload: { endpoint: 'slate', surface: 'slate' }
	} as never);
	return { session, main, slate };
}

describe('ToolSession.resizeSurface', () => {
	test('forwards resize to the main channel only', () => {
		const { session, main, slate } = readySession();
		session.resizeSurface('main', { width: 800, height: 600 });
		const resizes = main.messages.filter((m) => m.name === 'surface.resize');
		expect(resizes.length).toBe(1);
		expect(resizes[0].payload).toEqual({ width: 800, height: 600 });
		expect(resizes[0].sessionId).toBe(session.sessionId);
		expect(slate.messages.filter((m) => m.name === 'surface.resize').length).toBe(0);
		session.close();
	});

	test('forwards resize to the slate channel only', () => {
		const { session, main, slate } = readySession();
		session.resizeSurface('slate', { width: 220, height: 120 });
		const resizes = slate.messages.filter((m) => m.name === 'surface.resize');
		expect(resizes.length).toBe(1);
		expect(resizes[0].payload).toEqual({ width: 220, height: 120 });
		expect(main.messages.filter((m) => m.name === 'surface.resize').length).toBe(0);
		session.close();
	});

	test('ignores resize without a booted channel or after close', () => {
		const session = new ToolSession({ entry: makeEntry() });
		// No channel yet — must not throw.
		session.resizeSurface('main', { width: 10, height: 10 });
		const pair = createInMemoryTransportPair();
		const main = recordTransport(pair.container);
		session.boot({ main: pair.host, surface: { kind: 'canvas', width: 1, height: 1 } });
		session.close();
		const count = main.messages.filter((m) => m.name === 'surface.resize').length;
		session.resizeSurface('main', { width: 20, height: 20 });
		assert.equal(main.messages.filter((m) => m.name === 'surface.resize').length, count);
	});
});
