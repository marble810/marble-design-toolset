import { test } from 'node:test';
import assert from 'node:assert/strict';

import validEntry from '../fixtures/valid-shallow-water.ts';
import { defineVisualTool, defineInspectorCallback } from 'tool-sdk';
import { evaluateToolDefinition } from '../src/extract.ts';
import { inputFor } from './helpers.ts';

test('extraction is deterministic across repeated runs', () => {
	const a = evaluateToolDefinition(inputFor(validEntry));
	const b = evaluateToolDefinition(inputFor(validEntry));
	assert.equal(a.ok && b.ok, true);
	if (!a.ok || !b.ok) return;
	assert.deepEqual(b.entry, a.entry);
	assert.equal(b.entry.catalogEntryId, a.entry.catalogEntryId);
});

test('extraction is deterministic across JSON round-trips', () => {
	const a = evaluateToolDefinition(inputFor(validEntry));
	if (!a.ok) return;
	const roundTrip = JSON.parse(JSON.stringify(a.entry));
	assert.deepEqual(roundTrip, a.entry);
});

test('map declaration order does not change the Catalog Entry (maps are sorted)', () => {
	const forward = defineVisualTool({
		parameters: {
			amplitude: {
				type: 'number',
				label: 'Amplitude',
				default: 0.5,
				mode: 'manual',
				constraint: { type: 'number', min: 0, max: 1 }
			},
			zebra: {
				type: 'boolean',
				label: 'Zebra',
				default: false,
				mode: 'manual',
				constraint: { type: 'boolean' }
			},
			delta: {
				type: 'number',
				label: 'Delta',
				default: 1,
				mode: 'manual',
				constraint: { type: 'number', min: 0, max: 10 }
			}
		},
		privateCallbacks: {},
		createInspector({ root, parameters }) {
			root.slider({ id: 'delta', label: 'Delta', bind: parameters.delta });
			root.slider({ id: 'amplitude', label: 'Amplitude', bind: parameters.amplitude });
			root.toggle({ id: 'zebra', label: 'Zebra', bind: parameters.zebra });
		},
		canvas: () => import('./virtual-canvas.ts')
	});

	const reversed = defineVisualTool({
		parameters: {
			delta: {
				type: 'number',
				label: 'Delta',
				default: 1,
				mode: 'manual',
				constraint: { type: 'number', min: 0, max: 10 }
			},
			zebra: {
				type: 'boolean',
				label: 'Zebra',
				default: false,
				mode: 'manual',
				constraint: { type: 'boolean' }
			},
			amplitude: {
				type: 'number',
				label: 'Amplitude',
				default: 0.5,
				mode: 'manual',
				constraint: { type: 'number', min: 0, max: 1 }
			}
		},
		privateCallbacks: {},
		createInspector({ root, parameters }) {
			root.slider({ id: 'delta', label: 'Delta', bind: parameters.delta });
			root.slider({ id: 'amplitude', label: 'Amplitude', bind: parameters.amplitude });
			root.toggle({ id: 'zebra', label: 'Zebra', bind: parameters.zebra });
		},
		canvas: () => import('./virtual-canvas.ts')
	});

	const a = evaluateToolDefinition(inputFor(forward));
	const b = evaluateToolDefinition(inputFor(reversed));
	assert.equal(a.ok && b.ok, true, JSON.stringify([a.diagnostics, b.diagnostics], null, 2));
	if (!a.ok || !b.ok) return;
	assert.deepEqual(a.entry, b.entry);
	assert.deepEqual(Object.keys(a.entry.parameters), ['amplitude', 'delta', 'zebra']);
});
