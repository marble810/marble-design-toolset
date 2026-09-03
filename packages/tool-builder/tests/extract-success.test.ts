import { test } from 'node:test';
import assert from 'node:assert/strict';

import validEntry from '../fixtures/valid-shallow-water.ts';
import { VALID_MANIFEST, DESKTOP_SOURCE, PROJECT_ID, ARTIFACTS } from '../fixtures/manifest.ts';
import { evaluateToolDefinition } from '../src/extract.ts';
import { assertSerializable, catalogEntryId } from 'tool-contract';
import { inputFor } from './helpers.ts';

test('valid fixture extracts to a usable Catalog Entry', () => {
	const out = evaluateToolDefinition(inputFor(validEntry));
	assert.equal(out.ok, true, JSON.stringify(out.diagnostics ?? [], null, 2));
	if (!out.ok) return;
	const entry = out.entry;

	assert.equal(entry.catalogEntryId, catalogEntryId(DESKTOP_SOURCE, PROJECT_ID));
	assert.equal(entry.projectId, PROJECT_ID);
	assert.equal(entry.slug, 'shallow-water');
	assert.equal(entry.forgeProfile, 'forge-v1');
	assert.deepEqual(entry.libraries, ['three']);
	assert.deepEqual(entry.surfaces, { canvas: true, slate: false });
	assert.equal(entry.artifacts.main, ARTIFACTS.main);
	assert.equal(entry.artifacts.slate, undefined);
});

test('extracted entry carries stable-ID descriptor maps', () => {
	const out = evaluateToolDefinition(inputFor(validEntry));
	if (!out.ok) return;
	const entry = out.entry;

	assert.deepEqual(Object.keys(entry.parameters).sort(), ['amplitude', 'damping', 'invert', 'sourceMode']);
	assert.equal(entry.parameters.amplitude.id, 'amplitude');
	assert.deepEqual(entry.privateCallbacks, { resimulate: { id: 'resimulate' } });
	assert.deepEqual(entry.commands, { resetView: { id: 'resetView', label: 'Reset View' } });
	assert.deepEqual(entry.assets.initMap, {
		id: 'initMap',
		kind: 'image',
		label: 'Init Map',
		accept: ['image/png', 'image/jpeg'],
		required: false
	});
	assert.deepEqual(entry.outputs.heightMap, { id: 'heightMap', kind: 'image', label: 'Height Map', mime: 'image/png' });
});

test('extracted inspector tree resolves parameter/command/private-callback bindings', () => {
	const out = evaluateToolDefinition(inputFor(validEntry));
	if (!out.ok) return;
	const { elements } = out.entry.inspectorTree;

	assert.deepEqual(elements[0], {
		kind: 'section',
		id: 'source',
		title: 'Source',
		children: [
			{ kind: 'select', id: 'sourceMode', label: 'Source Mode', binding: { kind: 'parameter', parameterId: 'sourceMode' } }
		]
	});

	const resimulate = elements.find((el) => el.kind === 'button' && el.id === 'resimulate');
	assert.deepEqual(resimulate, {
		kind: 'button',
		id: 'resimulate',
		label: 'Resimulate',
		binding: { kind: 'private-callback', callbackId: 'resimulate' }
	});
	const reset = elements.find((el) => el.kind === 'button' && el.id === 'resetView');
	assert.deepEqual(reset, { kind: 'button', id: 'resetView', label: 'Reset View', binding: { kind: 'command', commandId: 'resetView' } });
});

test('Catalog Entry contains no functions, DOM, Svelte or library objects', () => {
	const out = evaluateToolDefinition(inputFor(validEntry));
	if (!out.ok) return;
	const entry = out.entry;

	assert.deepEqual(assertSerializable(entry), []);

	const json = JSON.stringify(entry);
	assert.equal(json.includes('function'), false, 'serialized entry must not contain any function');
	const roundTrip = JSON.parse(json);
	assert.deepEqual(roundTrip, entry);
});

test('invalid manifest does not produce a Catalog Entry', () => {
	const out = evaluateToolDefinition(
		inputFor(validEntry, {
			manifest: { ...VALID_MANIFEST, parameters: { leaked: true } }
		})
	);
	assert.equal(out.ok, false);
	assert.equal(out.entry, undefined);
	if (!out.ok) assert.ok(out.diagnostics.some((d) => d.code === 'manifest/forbidden-field'));
});
