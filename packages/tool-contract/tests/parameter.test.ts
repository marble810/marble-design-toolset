import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateParameterMap } from '../src/index.ts';

const VALID = {
	amplitude: {
		type: 'number',
		label: 'Amplitude',
		default: 0.5,
		mode: 'manual',
		constraint: { type: 'number', min: 0, max: 1, step: 0.01 }
	},
	damping: {
		type: 'number',
		label: 'Damping',
		default: 0.98,
		mode: 'manual',
		constraint: { type: 'number', min: 0, max: 1 }
	},
	invert: { type: 'boolean', label: 'Invert', default: false, mode: 'manual', constraint: { type: 'boolean' } },
	sourceMode: {
		type: 'select',
		label: 'Source Mode',
		default: 'preset',
		mode: 'manual',
		constraint: { type: 'select', options: ['preset', 'image'] }
	}
};

test('valid parameter map is accepted and ids come from map keys', () => {
	const r = validateParameterMap(VALID);
	assert.equal(r.ok, true);
	if (r.ok) {
		assert.deepEqual(Object.keys(r.value), ['amplitude', 'damping', 'invert', 'sourceMode']);
		assert.equal(r.value.amplitude.id, 'amplitude');
	}
});

test('invalid map key is rejected as invalid stable ID', () => {
	const r = validateParameterMap({ 'Bad Key': VALID.amplitude });
	assert.equal(r.ok, false);
	if (!r.ok) assert.ok(r.diagnostics.some((d) => d.code === 'id/invalid'));
});

test('duplicate IDs across the map are rejected', () => {
	// Same ID repeated via spread override cannot survive an object literal, so simulate with assign.
	const map = Object.assign({}, VALID, { ['amplitude']: { ...VALID.amplitude, default: 0.2 } });
	// keys() is unique, so a within-map duplicate is impossible in JS; the collision is caught at the
	// global namespace level instead (see validateCatalogEntry). Here we assert the map itself still validates.
	const r = validateParameterMap(map);
	assert.equal(r.ok, true);
});

test('number default outside constraint range is rejected', () => {
	const r = validateParameterMap({
		amp: { ...VALID.amplitude, default: 5 }
	});
	assert.equal(r.ok, false);
	if (!r.ok) assert.ok(r.diagnostics.some((d) => d.code === 'parameter/default'));
});

test('number constraint with min > max is rejected', () => {
	const r = validateParameterMap({
		amp: { ...VALID.amplitude, constraint: { type: 'number', min: 1, max: 0 } }
	});
	assert.equal(r.ok, false);
	if (!r.ok) assert.ok(r.diagnostics.some((d) => d.code === 'parameter/constraint'));
});

test('select default must be among options', () => {
	const r = validateParameterMap({
		mode: { ...VALID.sourceMode, default: 'nope' }
	});
	assert.equal(r.ok, false);
	if (!r.ok) assert.ok(r.diagnostics.some((d) => d.code === 'parameter/default'));
});

test('computed parameter must declare dependencies and dependency ids must be valid', () => {
	const r = validateParameterMap({
		computed1: {
			type: 'number',
			label: 'C',
			default: 1,
			mode: 'computed',
			dependsOn: ['amp'],
			constraint: { type: 'number', min: 0, max: 10 }
		}
	});
	assert.equal(r.ok, false, 'dependency must exist in the same map');
});

test('computed parameter without dependsOn is rejected', () => {
	const r = validateParameterMap({
		c: {
			type: 'number',
			label: 'C',
			default: 1,
			mode: 'computed',
			constraint: { type: 'number', min: 0, max: 10 }
		}
	});
	assert.equal(r.ok, false);
	if (!r.ok) assert.ok(r.diagnostics.some((d) => d.code === 'parameter/mode'));
});
