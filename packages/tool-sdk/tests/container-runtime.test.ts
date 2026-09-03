/**
 * Tool Container runtime unit tests: boot validation and handshake, queued
 * definition-dependent work, export/compute error paths and shutdown semantics.
 * Message-flow semantics shared with the Host are covered by the tool-host conformance
 * suite; these tests pin container-specific behavior.
 */
import { describe, expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import {
	createEnvironmentEnvelope,
	createInMemoryTransportPair,
	type CatalogEntry,
	type EnvironmentEnvelope
} from 'tool-contract';
import { startToolContainer, type VisualToolDefinition } from '../src/index.ts';

const SESSION_ID = 'container-unit-session';

function bootEnvelope(endpoint: 'main' | 'slate', overrides: Partial<Record<string, unknown>> = {}): EnvironmentEnvelope {
	return createEnvironmentEnvelope({
		sessionId: SESSION_ID,
		kind: 'request',
		name: 'boot',
		payload: {
			endpoint,
			parameters: { revision: 0, values: {}, revisions: {} },
			assets: { values: {} },
			surface: { kind: endpoint === 'main' ? 'canvas' : 'slate', width: 100, height: 100 },
			inventory: { assets: [], exports: [] },
			...overrides
		}
	});
}

function definitionStub(overrides: Partial<VisualToolDefinition> = {}): VisualToolDefinition {
	return {
		parameters: {},
		privateCallbacks: {},
		canvas: () => Promise.resolve(undefined),
		...overrides
	};
}

function start(pair = createInMemoryTransportPair(), endpoint: 'main' | 'slate' = 'main', definition = definitionStub()) {
	const bootErrors: string[] = [];
	const invalid: string[] = [];
	const unmounts: number[] = [];
	let loadCount = 0;
	const runtime = startToolContainer({
		transport: pair.container,
		endpoint,
		loadDefinition: () => {
			loadCount += 1;
			return Promise.resolve(definition);
		},
		mountSurface: () => {
			unmounts.push(unmounts.length + 1);
			return () => unmounts.push(-1);
		},
		onBootError: (d) => bootErrors.push(d.code),
		onInvalidMessage: (reason) => invalid.push(reason)
	});
	return { pair, runtime, bootErrors, invalid, unmounts, loadCount: () => loadCount };
}

describe('startToolContainer', () => {
	test('ignores pre-boot non-boot messages and answers a valid boot', async () => {
		const { pair, runtime } = start();
		pair.host.send(createEnvironmentEnvelope({ sessionId: SESSION_ID, kind: 'event', name: 'parameter.changed', payload: { id: 'x', value: 1, revision: 1 } }));
		pair.host.send(bootEnvelope('main'));
		await runtime.ready;
		expect(runtime.context.sessionId).toBe(SESSION_ID);
		expect(runtime.context.surface()).toEqual({ kind: 'canvas', width: 100, height: 100 });
	});

	test('ignores a boot with a mismatched endpoint role and waits for a valid boot', async () => {
		const { pair, runtime, bootErrors } = start(undefined, 'slate');
		pair.host.send(bootEnvelope('main'));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(bootErrors).toContain('container/endpoint-mismatch');
		// A later correct boot still works: the container kept waiting.
		pair.host.send(bootEnvelope('slate'));
		await runtime.ready;
		expect(runtime.context.surface().kind).toBe('slate');
	});

	test('queues command/compute/export until the definition is loaded', async () => {
		const commandsRun: string[] = [];
		const def = definitionStub({
			commands: { ping: { label: 'Ping', run: () => commandsRun.push('ping') } }
		});
		const { pair, runtime } = start(undefined, 'main', def);
		// Boot, then immediately send a command in the same tick (definition not loaded yet).
		pair.host.send(bootEnvelope('main'));
		pair.host.send(
			createEnvironmentEnvelope({
				sessionId: SESSION_ID,
				kind: 'request',
				name: 'command.execute',
				requestId: 'cmd-1',
				payload: { commandId: 'ping', invocationId: 'inv-1' }
			})
		);
		expect(commandsRun).toEqual([]);
		await runtime.ready;
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(commandsRun).toEqual(['ping']);
		const results = (pair.host as unknown as { messages?: EnvironmentEnvelope[] }).messages ?? [];
		void results;
	});

	test('executes Inspector private callbacks through the shared command protocol', async () => {
		const callbacksRun: string[] = [];
		const def = definitionStub({
			privateCallbacks: {
				ping: { __deshelfCallbackTag: 'inspector-callback', run: () => callbacksRun.push('ping') }
			}
		});
		const { pair, runtime } = start(undefined, 'main', def);
		const seen: EnvironmentEnvelope[] = [];
		pair.host.subscribe((message) => seen.push(message));
		pair.host.send(bootEnvelope('main'));
		await runtime.ready;
		pair.host.send(
			createEnvironmentEnvelope({
				sessionId: SESSION_ID,
				kind: 'request',
				name: 'command.execute',
				requestId: 'private-1',
				payload: { commandId: 'ping', invocationId: 'private-inv-1' }
			})
		);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(callbacksRun).toEqual(['ping']);
		expect(seen.find((message) => message.name === 'command.result')?.payload).toMatchObject({
			invocationId: 'private-inv-1',
			ok: true
		});
	});

	test('aborts a running callback but preserves its actual grace-period result', async () => {
		let resolveRun!: () => void;
		let receivedSignal: AbortSignal | undefined;
		const run = (context: { signal: AbortSignal }) => {
			receivedSignal = context.signal;
			return new Promise<void>((resolve) => (resolveRun = resolve));
		};
		const def = definitionStub({ commands: { slow: { label: 'Slow', run } } });
		const { pair, runtime } = start(undefined, 'main', def);
		const seen: EnvironmentEnvelope[] = [];
		pair.host.subscribe((message) => seen.push(message));
		pair.host.send(bootEnvelope('main'));
		await runtime.ready;
		pair.host.send(createEnvironmentEnvelope({
			sessionId: SESSION_ID,
			kind: 'request',
			name: 'command.execute',
			requestId: 'slow-1',
			payload: { commandId: 'slow', invocationId: 'slow-inv-1' }
		}));
		await new Promise((resolve) => setTimeout(resolve, 0));
		pair.host.send(createEnvironmentEnvelope({
			sessionId: SESSION_ID,
			kind: 'request',
			name: 'command.cancel',
			requestId: 'cancel-1',
			payload: { invocationId: 'slow-inv-1' }
		}));
		expect(receivedSignal?.aborted).toBe(true);
		resolveRun();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(seen.find((message) => message.name === 'command.result')?.payload).toMatchObject({
			invocationId: 'slow-inv-1',
			ok: true
		});
	});

	test('preserves cancellation received while the Tool definition is loading', async () => {
		const pair = createInMemoryTransportPair();
		let releaseDefinition!: (definition: VisualToolDefinition) => void;
		let receivedSignal: AbortSignal | undefined;
		const definitionPromise = new Promise<VisualToolDefinition>((resolve) => (releaseDefinition = resolve));
		const run = (context: { signal: AbortSignal }) => {
			receivedSignal = context.signal;
		};
		const runtime = startToolContainer({
			transport: pair.container,
			endpoint: 'main',
			loadDefinition: () => definitionPromise,
			mountSurface: () => () => {}
		});
		pair.host.send(bootEnvelope('main'));
		pair.host.send(createEnvironmentEnvelope({
			sessionId: SESSION_ID,
			kind: 'request',
			name: 'command.execute',
			requestId: 'queued-1',
			payload: { commandId: 'queued', invocationId: 'queued-inv-1' }
		}));
		pair.host.send(createEnvironmentEnvelope({
			sessionId: SESSION_ID,
			kind: 'request',
			name: 'command.cancel',
			requestId: 'queued-cancel-1',
			payload: { invocationId: 'queued-inv-1' }
		}));
		releaseDefinition(definitionStub({ commands: { queued: { label: 'Queued', run } } }));
		await runtime.ready;
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(receivedSignal?.aborted).toBe(true);
	});

	test('unknown command answers a failed command.result', async () => {
		const { pair, runtime } = start();
		const seen: EnvironmentEnvelope[] = [];
		pair.host.subscribe((m) => seen.push(m));
		pair.host.send(bootEnvelope('main'));
		await runtime.ready;
		pair.host.send(
			createEnvironmentEnvelope({
				sessionId: SESSION_ID,
				kind: 'request',
				name: 'command.execute',
				requestId: 'cmd-2',
				payload: { commandId: 'nope', invocationId: 'inv-2' }
			})
		);
		await new Promise((resolve) => setTimeout(resolve, 0));
		const result = seen.find((m) => m.name === 'command.result');
		assert.ok(result);
		expect(result.payload).toMatchObject({ invocationId: 'inv-2', ok: false });
	});

	test('compute errors produce a compute-invalid diagnostic response', async () => {
		const def = definitionStub({
			parameters: {
				broken: {
					type: 'number',
					label: 'Broken',
					default: 0,
					mode: 'computed',
					constraint: { type: 'number', min: 0, max: 1 },
					compute: () => {
						throw new Error('boom');
					}
				}
			}
		});
		const { pair, runtime } = start(undefined, 'main', def);
		const seen: EnvironmentEnvelope[] = [];
		pair.host.subscribe((m) => seen.push(m));
		pair.host.send(bootEnvelope('main'));
		await runtime.ready;
		pair.host.send(
			createEnvironmentEnvelope({
				sessionId: SESSION_ID,
				kind: 'request',
				name: 'parameter.compute',
				requestId: 'compute-1',
				payload: { ids: ['broken'], dependencies: { revision: 0, values: {}, revisions: {} } }
			})
		);
		await new Promise((resolve) => setTimeout(resolve, 0));
		const response = seen.find((m) => m.name === 'parameter.compute' && m.kind === 'response');
		assert.ok(response);
		const payload = response.payload as { values: Record<string, number>; diagnostics: Array<{ code: string }> };
		expect(payload.values).toEqual({});
		expect(payload.diagnostics[0].code).toBe('parameter/compute-invalid');
	});

	test('export render result becomes a blob-url content reference', async () => {
		const def = definitionStub({
			outputs: {
				shot: {
					kind: 'image',
					label: 'Shot',
					mime: 'image/png',
					render: () => new Uint8Array([9, 9, 9])
				}
			}
		});
		const { pair, runtime } = start(undefined, 'main', def);
		const seen: EnvironmentEnvelope[] = [];
		pair.host.subscribe((m) => seen.push(m));
		pair.host.send(bootEnvelope('main'));
		await runtime.ready;
		pair.host.send(
			createEnvironmentEnvelope({
				sessionId: SESSION_ID,
				kind: 'request',
				name: 'export.execute',
				requestId: 'export-1',
				payload: { outputId: 'shot', invocationId: 'exp-1' }
			})
		);
		await new Promise((resolve) => setTimeout(resolve, 0));
		const result = seen.find((m) => m.name === 'export.result');
		assert.ok(result);
		const payload = result.payload as { ok: boolean; content?: { kind: string; mime: string; url: string } };
		expect(payload.ok).toBe(true);
		expect(payload.content?.kind).toBe('blob-url');
		expect(payload.content?.mime).toBe('image/png');
		expect(payload.content?.url.startsWith('blob:')).toBe(true);
	});

	test('surface.dispose unmounts, disposes the Tool definition exactly once and resolves disposed', async () => {
		let disposeCount = 0;
		const { pair, runtime, unmounts } = start(undefined, 'main', definitionStub({ dispose: () => (disposeCount += 1) }));
		pair.host.send(bootEnvelope('main'));
		await runtime.ready;
		expect(unmounts.length).toBe(1);
		pair.host.send(createEnvironmentEnvelope({ sessionId: SESSION_ID, kind: 'event', name: 'surface.dispose', payload: { reason: 'test' } }));
		expect(await runtime.disposed).toBe('surface-dispose');
		expect(unmounts).toContain(-1);
		expect(disposeCount).toBe(1);
		runtime.close();
		expect(disposeCount).toBe(1);
	});

	test('close() shuts down without a Host dispose', async () => {
		const { runtime } = start();
		runtime.close();
		await expect(runtime.ready).rejects.toThrow(/shutdown/);
		expect(await runtime.disposed).toBe('closed');
	});

	test('mount errors reject ready, dispose the loaded definition and report a boot-failed diagnostic', async () => {
		const pair = createInMemoryTransportPair();
		const bootErrors: string[] = [];
		let disposeCount = 0;
		const definition = definitionStub({ dispose: () => (disposeCount += 1) });
		const runtime = startToolContainer({
			transport: pair.container,
			endpoint: 'main',
			loadDefinition: () => Promise.resolve(definition),
			mountSurface: () => {
				throw new Error('mount failed');
			},
			onBootError: (d) => bootErrors.push(d.code)
		});
		const emitted: EnvironmentEnvelope[] = [];
		pair.host.subscribe((m) => emitted.push(m));
		pair.host.send(bootEnvelope('main'));
		await expect(runtime.ready).rejects.toThrow(/mount failed/);
		expect(bootErrors).toContain('container/boot-failed');
		expect(disposeCount).toBe(1);
		const diag = emitted.find((m) => m.name === 'diagnostic.emit');
		assert.ok(diag);
		expect((diag.payload as { diagnostic: { code: string } }).diagnostic.code).toBe('container/boot-failed');
	});

	test('duplicate boots are ignored after the first session begins', async () => {
		const { pair, runtime, loadCount } = start();
		pair.host.send(bootEnvelope('main'));
		await runtime.ready;
		pair.host.send(bootEnvelope('main'));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(loadCount()).toBe(1);
		expect(runtime.context.sessionId).toBe(SESSION_ID);
	});
});

void ({} as CatalogEntry);
