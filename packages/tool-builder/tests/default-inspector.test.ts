import { test } from 'node:test';
import assert from 'node:assert/strict';

import { defineVisualTool } from 'tool-sdk';
import { evaluateToolDefinition } from '../src/extract.ts';
import { inputFor } from './helpers.ts';

test('missing createInspector produces a deterministic default Inspector Tree from Parameter descriptors', () => {
	const definition = defineVisualTool({
		parameters: {
			title: {
				type: 'string',
				label: 'Title',
				default: 'Water',
				mode: 'manual',
				constraint: { type: 'string', maxLength: 80 }
			},
			amplitude: {
				type: 'number',
				label: 'Amplitude',
				default: 0.5,
				mode: 'manual',
				constraint: { type: 'number', min: 0, max: 1 }
			},
			invert: {
				type: 'boolean',
				label: 'Invert',
				default: false,
				mode: 'manual',
				constraint: { type: 'boolean' }
			},
			sourceMode: {
				type: 'select',
				label: 'Source Mode',
				default: 'preset',
				mode: 'manual',
				constraint: { type: 'select', options: ['preset', 'image'] }
			}
		},
		privateCallbacks: {},
		canvas: () => import('./virtual-canvas.ts')
	});

	const outcome = evaluateToolDefinition(inputFor(definition));
	assert.equal(outcome.ok, true, JSON.stringify(outcome.diagnostics));
	if (!outcome.ok || outcome.entry === undefined) return;
	assert.deepEqual(outcome.entry.inspectorTree.elements, [
		{ kind: 'slider', id: 'amplitude', label: 'Amplitude', binding: { kind: 'parameter', parameterId: 'amplitude' } },
		{ kind: 'toggle', id: 'invert', label: 'Invert', binding: { kind: 'parameter', parameterId: 'invert' } },
		{ kind: 'select', id: 'sourceMode', label: 'Source Mode', binding: { kind: 'parameter', parameterId: 'sourceMode' } },
		{ kind: 'text', id: 'title', label: 'Title', binding: { kind: 'parameter', parameterId: 'title' } }
	]);
});
