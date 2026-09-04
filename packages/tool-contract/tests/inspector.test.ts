import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateInspectorTree } from '../src/index.ts';

const CTX = {
	parameters: new Set(['amplitude', 'invert', 'sourceMode']),
	commands: new Set(['resetView']),
	callbacks: new Set(['resimulate'])
};

test('valid inspector tree binds parameter/command/private-callback targets', () => {
	const tree = {
		elements: [
			{ kind: 'label', id: 'lbl', text: 'Hello' },
			{ kind: 'slider', id: 'amp', label: 'Amplitude', binding: { kind: 'parameter', parameterId: 'amplitude' } },
			{ kind: 'toggle', id: 'inv', label: 'Invert', binding: { kind: 'parameter', parameterId: 'invert' } },
			{ kind: 'button', id: 'resim', label: 'Resimulate', binding: { kind: 'private-callback', callbackId: 'resimulate' } },
			{ kind: 'button', id: 'reset', label: 'Reset View', binding: { kind: 'command', commandId: 'resetView' } }
		]
	};
	const r = validateInspectorTree(tree, CTX);
	assert.equal(r.ok, true, JSON.stringify(r.ok ? null : r.diagnostics, null, 2));
});

test('binding to an undeclared private callback is rejected', () => {
	const tree = {
		elements: [
			{ kind: 'button', id: 'b', label: 'B', binding: { kind: 'private-callback', callbackId: 'nonexistent' } }
		]
	};
	const r = validateInspectorTree(tree, CTX);
	assert.equal(r.ok, false);
	if (!r.ok) assert.ok(r.diagnostics.some((d) => d.code === 'inspector/binding'));
});

test('binding a parameter to a button is rejected (kind mismatch)', () => {
	const tree = {
		elements: [
			{ kind: 'button', id: 'b', label: 'B', binding: { kind: 'parameter', parameterId: 'amplitude' } }
		]
	};
	const r = validateInspectorTree(tree, CTX);
	assert.equal(r.ok, false);
	if (!r.ok) assert.ok(r.diagnostics.some((d) => d.code === 'inspector/binding-kind'));
});

test('duplicate element ids inside the tree are rejected', () => {
	const tree = {
		elements: [
			{ kind: 'label', id: 'dup', text: 'a' },
			{ kind: 'label', id: 'dup', text: 'b' }
		]
	};
	const r = validateInspectorTree(tree, CTX);
	assert.equal(r.ok, false);
	if (!r.ok) assert.ok(r.diagnostics.some((d) => d.code === 'inspector/duplicate-element'));
});

test('nested section children are validated', () => {
	const tree = {
		elements: [
			{
				kind: 'section',
				id: 'src',
				title: 'Source',
				children: [
					{ kind: 'button', id: 'b', label: 'B', binding: { kind: 'private-callback', callbackId: 'missing' } }
				]
			}
		]
	};
	const r = validateInspectorTree(tree, CTX);
	assert.equal(r.ok, false);
	if (!r.ok) assert.ok(r.diagnostics.some((d) => d.code === 'inspector/binding'));
});

test('valid visibleWhen rules are accepted', () => {
	const tree = {
		elements: [
			{
				kind: 'section',
				id: 'preset',
				title: 'Preset',
				visibleWhen: { parameterId: 'sourceMode', equals: 'preset' },
				children: [
					{
						kind: 'slider',
						id: 'size',
						label: 'Size',
						binding: { kind: 'parameter', parameterId: 'amplitude' },
						visibleWhen: { parameterId: 'sourceMode', equals: ['preset'] }
					}
				]
			},
			{
				kind: 'button',
				id: 'resim',
				label: 'Resimulate',
				binding: { kind: 'private-callback', callbackId: 'resimulate' },
				visibleWhen: { parameterId: 'invert', equals: [true, false] }
			}
		]
	};
	const r = validateInspectorTree(tree, CTX);
	assert.equal(r.ok, true, JSON.stringify(r.ok ? null : r.diagnostics, null, 2));
});

test('visibleWhen referencing an unknown parameter is rejected', () => {
	const tree = {
		elements: [
			{
				kind: 'slider',
				id: 'amp',
				label: 'Amplitude',
				binding: { kind: 'parameter', parameterId: 'amplitude' },
				visibleWhen: { parameterId: 'nonexistent', equals: 1 }
			}
		]
	};
	const r = validateInspectorTree(tree, CTX);
	assert.equal(r.ok, false);
	if (!r.ok) assert.ok(r.diagnostics.some((d) => d.code === 'inspector/visible-when'));
});

test('visibleWith non-primitive or empty equals is rejected', () => {
	const cases: Array<Record<string, unknown>> = [
		{ parameterId: 'amplitude', equals: [] },
		{ parameterId: 'amplitude', equals: [null] },
		{ parameterId: 'amplitude', equals: { match: 1 } },
		{ parameterId: 'amplitude' }
	];
	for (const visibleWhen of cases) {
		const tree = {
			elements: [
				{
					kind: 'toggle',
					id: 'inv',
					label: 'Invert',
					binding: { kind: 'parameter', parameterId: 'invert' },
					visibleWhen: visibleWhen as never
				}
			]
		};
		const r = validateInspectorTree(tree, CTX);
		assert.equal(r.ok, false, JSON.stringify(visibleWhen));
		if (!r.ok) assert.ok(r.diagnostics.some((d) => d.code === 'inspector/visible-when'), JSON.stringify(visibleWhen));
	}
});
