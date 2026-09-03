import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateParameterMap } from '../src/index.ts';

function computed(id: string, dependsOn: readonly string[]) {
	return {
		[id]: {
			type: 'number',
			label: id,
			default: 1,
			mode: 'computed',
			dependsOn,
			constraint: { type: 'number', min: 0, max: 100 }
		}
	};
}

test('self-dependency is rejected', () => {
	const r = validateParameterMap(computed('a', ['a']));
	assert.equal(r.ok, false);
	if (!r.ok) assert.ok(r.diagnostics.some((d) => d.code === 'parameter/depends-on' && d.message.includes('itself')));
});

test('duplicate dependencies are rejected', () => {
	const r = validateParameterMap({
		...computed('c', ['a', 'a']),
		a: { type: 'number', label: 'A', default: 1, mode: 'manual', constraint: { type: 'number', min: 0, max: 10 } }
	});
	assert.equal(r.ok, false);
	if (!r.ok) assert.ok(r.diagnostics.some((d) => d.code === 'parameter/depends-on' && d.message.includes('duplicate')));
});

test('direct two-node cycle is rejected', () => {
	const r = validateParameterMap({
		...computed('a', ['b']),
		...computed('b', ['a'])
	});
	assert.equal(r.ok, false);
	if (!r.ok) assert.ok(r.diagnostics.some((d) => d.code === 'parameter/depends-on' && d.message.includes('cycle')));
});

test('longer dependency cycle is rejected', () => {
	const r = validateParameterMap({
		...computed('a', ['b']),
		...computed('b', ['c']),
		...computed('c', ['a'])
	});
	assert.equal(r.ok, false);
	if (!r.ok) assert.ok(r.diagnostics.some((d) => d.code === 'parameter/depends-on' && d.message.includes('cycle')));
});

test('acyclic computed graph is accepted', () => {
	const r = validateParameterMap({
		...computed('c', ['a', 'b']),
		a: { type: 'number', label: 'A', default: 1, mode: 'manual', constraint: { type: 'number', min: 0, max: 10 } },
		b: { type: 'number', label: 'B', default: 2, mode: 'manual', constraint: { type: 'number', min: 0, max: 10 } }
	});
	assert.equal(r.ok, true, JSON.stringify(r.ok ? null : r.diagnostics, null, 2));
});

test('dependencies that skip through manual parameters do not create false cycles', () => {
	const r = validateParameterMap({
		...computed('x', ['m']),
		...computed('y', ['x']),
		m: { type: 'number', label: 'M', default: 1, mode: 'manual', constraint: { type: 'number', min: 0, max: 10 } }
	});
	assert.equal(r.ok, true, JSON.stringify(r.ok ? null : r.diagnostics, null, 2));
});

test('unknown dependency is rejected even inside an otherwise valid graph', () => {
	const r = validateParameterMap(computed('a', ['missing']));
	assert.equal(r.ok, false);
	if (!r.ok) assert.ok(r.diagnostics.some((d) => d.code === 'parameter/depends-on' && d.message.includes('unknown')));
});

test('non-finite number constraints and defaults are rejected', () => {
	const base = {
		type: 'number' as const,
		label: 'A',
		default: 1,
		mode: 'manual' as const
	};
	assert.equal(validateParameterMap({ a: { ...base, constraint: { type: 'number', min: NaN, max: 1 } } }).ok, false);
	assert.equal(validateParameterMap({ a: { ...base, constraint: { type: 'number', min: 0, max: Infinity } } }).ok, false);
	assert.equal(validateParameterMap({ a: { ...base, default: NaN, constraint: { type: 'number', min: 0, max: 1 } } }).ok, false);
	assert.equal(validateParameterMap({ a: { ...base, constraint: { type: 'number', min: 0, max: 1, step: Infinity } } }).ok, false);
});
