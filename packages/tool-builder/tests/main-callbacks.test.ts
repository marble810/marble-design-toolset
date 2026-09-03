import { test } from 'node:test';
import assert from 'node:assert/strict';

import { defineInspectorCallback, defineVisualTool } from 'tool-sdk';
import { evaluateToolDefinition } from '../src/extract.ts';
import { inputFor } from './helpers.ts';

test('private callback definitions retain run; Catalog only keeps { id }', () => {
	const calls: string[] = [];
	const definition = defineVisualTool({
		parameters: {},
		commands: {},
		privateCallbacks: {
			resimulate: defineInspectorCallback({
				run(seed: number) {
					calls.push(`seed:${seed}`);
					return seed * 2;
				}
			})
		},
		outputs: {},
		createInspector({ root, privateCallbacks }) {
			root.button({ id: 'resimulate', label: 'Resimulate', bind: privateCallbacks.resimulate });
		},
		canvas: () => import('./virtual-canvas.ts')
	});

	// The runtime implementation remains callable from the definition...
	const callback = definition.privateCallbacks.resimulate as { run: (s: number) => number };
	assert.equal(callback.run(21), 42);
	assert.deepEqual(calls, ['seed:21']);

	// ...while the Catalog Entry is function-free and only carries the stable ID.
	const out = evaluateToolDefinition(inputFor(definition));
	assert.equal(out.ok, true, JSON.stringify(out.ok ? null : out.diagnostics, null, 2));
	if (!out.ok) return;
	assert.deepEqual(out.entry?.privateCallbacks, { resimulate: { id: 'resimulate' } });
	assert.deepEqual(JSON.parse(JSON.stringify(out.entry)).privateCallbacks, { resimulate: { id: 'resimulate' } });
});

test('a privateCallbacks value without the tag or without run fails evaluation', () => {
	for (const raw of [null, { __deshelfCallbackTag: 'inspector-callback' }, { __deshelfCallbackTag: 'other', run() {} }]) {
		const definition = defineVisualTool({
			parameters: {},
			commands: {},
			// @ts-expect-error intentionally invalid callback definition
			privateCallbacks: { resimulate: raw },
			outputs: {},
			createInspector() {},
			canvas: () => import('./virtual-canvas.ts')
		});
		const out = evaluateToolDefinition(inputFor(definition));
		assert.equal(out.ok, false);
		if (!out.ok) {
			assert.ok(out.diagnostics.some((d) => d.code === 'private-callback/invalid'), JSON.stringify(out.diagnostics));
		}
	}
});

test('commands without a run implementation fail evaluation', () => {
	const definition = defineVisualTool({
		parameters: {},
		// @ts-expect-error run is required
		commands: { resetView: { label: 'Reset View' } },
		privateCallbacks: {},
		outputs: {},
		createInspector() {},
		canvas: () => import('./virtual-canvas.ts')
	});
	const out = evaluateToolDefinition(inputFor(definition));
	assert.equal(out.ok, false);
	if (!out.ok) assert.ok(out.diagnostics.some((d) => d.code === 'command/run'));
});

test('outputs without a render implementation fail evaluation', () => {
	const definition = defineVisualTool({
		parameters: {},
		commands: {},
		privateCallbacks: {},
		// @ts-expect-error render is required
		outputs: { heightMap: { kind: 'image', label: 'Height Map', mime: 'image/png' } },
		createInspector() {},
		canvas: () => import('./virtual-canvas.ts')
	});
	const out = evaluateToolDefinition(inputFor(definition));
	assert.equal(out.ok, false);
	if (!out.ok) assert.ok(out.diagnostics.some((d) => d.code === 'output/render'));
});

test('computed parameters require a compute implementation at evaluation time', () => {
	const missing = defineVisualTool({
		parameters: {
			c: {
				type: 'number',
				label: 'C',
				default: 1,
				mode: 'computed',
				dependsOn: ['amp'],
				constraint: { type: 'number', min: 0, max: 10 }
			},
			amp: { type: 'number', label: 'Amp', default: 1, mode: 'manual', constraint: { type: 'number', min: 0, max: 10 } }
		},
		commands: {},
		privateCallbacks: {},
		outputs: {},
		createInspector() {},
		canvas: () => import('./virtual-canvas.ts')
	});
	const outMissing = evaluateToolDefinition(inputFor(missing));
	assert.equal(outMissing.ok, false);
	if (!outMissing.ok) assert.ok(outMissing.diagnostics.some((d) => d.code === 'parameter/compute'));

	const withCompute = defineVisualTool({
		parameters: {
			c: {
				type: 'number',
				label: 'C',
				default: 1,
				mode: 'computed',
				dependsOn: ['amp'],
				constraint: { type: 'number', min: 0, max: 10 },
				compute: (deps) => Number(deps.amp) * 2
			},
			amp: { type: 'number', label: 'Amp', default: 1, mode: 'manual', constraint: { type: 'number', min: 0, max: 10 } }
		},
		commands: {},
		privateCallbacks: {},
		outputs: {},
		createInspector() {},
		canvas: () => import('./virtual-canvas.ts')
	});
	const outWith = evaluateToolDefinition(inputFor(withCompute));
	assert.equal(outWith.ok, true, JSON.stringify(outWith.ok ? null : outWith.diagnostics, null, 2));
	if (!outWith.ok) return;
	// The compute implementation stays in the definition, never in the Catalog.
	const descriptor = outWith.entry?.parameters.c;
	assert.deepEqual(descriptor, {
		id: 'c',
		type: 'number',
		label: 'C',
		default: 1,
		mode: 'computed',
		constraint: { type: 'number', min: 0, max: 10 },
		dependsOn: ['amp']
	});
	assert.deepEqual(Object.keys(outWith.entry?.parameters.c ?? {}).sort(), [
		'constraint',
		'default',
		'dependsOn',
		'id',
		'label',
		'mode',
		'type'
	]);
});

test('invalid stable IDs are reported once, not duplicated across validators', () => {
	const definition = defineVisualTool({
		parameters: {
			'Bad Key': { type: 'number', label: 'X', default: 1, mode: 'manual', constraint: { type: 'number', min: 0, max: 1 } }
		},
		commands: {},
		privateCallbacks: {},
		outputs: {},
		createInspector() {},
		canvas: () => import('./virtual-canvas.ts')
	});
	const out = evaluateToolDefinition(inputFor(definition));
	assert.equal(out.ok, false);
	if (!out.ok) {
		const idErrors = out.diagnostics.filter((d) => d.code === 'id/invalid' && (d.path ?? '') === 'Bad Key');
		assert.equal(idErrors.length, 1, JSON.stringify(out.diagnostics));
	}
});