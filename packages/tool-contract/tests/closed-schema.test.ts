import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildValidCatalogEntry } from './helpers.ts';
import {
	validateCatalogEntry,
	validateCatalogSourceRef,
	validateManifest,
	assertSerializable,
	collectSerializationDiagnostics,
	catalogEntryId
} from '../src/index.ts';

const VALID_MANIFEST = {
	contractVersion: 1,
	projectId: '8f2c1a0e-1111-4222-8333-444455556666',
	slug: 'shallow-water',
	name: 'Shallow Water',
	description: 'd',
	tags: ['a'],
	version: '1.0.0',
	forgeProfile: 'forge-v1',
	libraries: ['three']
};

test('Manifest is a closed schema: every unknown field is rejected', () => {
	const leaked = ['enabled', 'assets', 'outputs', 'privateCallbacks', 'surfaces', 'entry', 'parameters', 'commands', 'inspector', 'capability', 'slate', 'export', 'randomFutureField'];
	for (const field of leaked) {
		const r = validateManifest({ ...VALID_MANIFEST, [field]: field === 'libraries' ? [] : {} });
		assert.equal(r.ok, false, `field '${field}' must be rejected`);
		if (!r.ok) {
			assert.ok(
				r.diagnostics.some((d) => d.code === 'manifest/unknown-field' || d.code === 'manifest/forbidden-field'),
				`field '${field}' must produce an unknown/forbidden-field diagnostic: ${JSON.stringify(r.diagnostics)}`
			);
		}
	}
});

test('Manifest still accepts only documented static fields', () => {
	const r = validateManifest(VALID_MANIFEST);
	assert.equal(r.ok, true, JSON.stringify(r.ok ? null : r.diagnostics, null, 2));
});

test('Manifest rejects malformed optional metadata instead of silently dropping it', () => {
	for (const input of [
		{ ...VALID_MANIFEST, description: 42 },
		{ ...VALID_MANIFEST, tags: 'simulation' },
		{ ...VALID_MANIFEST, tags: ['simulation', 42] }
	]) {
		const r = validateManifest(input);
		assert.equal(r.ok, false, JSON.stringify(input));
	}
});

test('validateManifest never throws on arbitrary input', () => {
	const cases: unknown[] = [undefined, null, 42, 'x', [], [1], { contractVersion: 'x' }, { slug: 'Bad Slug' }, { libraries: 'three' }, { libraries: ['pixi', 'three'] }, { name: 3 }, { description: 2 }, { tags: 'x' }, { tags: [1] }, { projectId: '' }];
	for (const c of cases) {
		assert.doesNotThrow(() => validateManifest(c), `input: ${JSON.stringify(c)}`);
	}
});

test('validateCatalogSourceRef never throws and validates the union', () => {
	assert.equal(validateCatalogSourceRef({ kind: 'web', sourceId: 'web-1' }).ok, true);
	assert.equal(validateCatalogSourceRef({ kind: 'desktop', projectLocationId: 'loc-1' }).ok, true);
	for (const bad of [undefined, null, 5, 'x', [], {}, { kind: 'web' }, { kind: 'web', sourceId: '' }, { kind: 'desktop', projectLocationId: '' }, { kind: 'process' }]) {
		assert.doesNotThrow(() => validateCatalogSourceRef(bad), `input: ${JSON.stringify(bad)}`);
		assert.equal(validateCatalogSourceRef(bad).ok, false);
	}
});

test('validateCatalogEntry never throws on malformed/fuzz input and rejects it', () => {
	const base = buildValidCatalogEntry();
	const malformed: unknown[] = [
		undefined,
		null,
		42,
		'slug',
		[],
		{},
		{ ...base, source: undefined },
		{ ...base, source: { kind: 'web' } },
		{ ...base, source: { kind: 'process' } },
		{ ...base, projectId: 5 },
		{ ...base, slug: 'Bad Slug' },
		{ ...base, version: 'v1' },
		{ ...base, name: '' },
		{ ...base, forgeProfile: null },
		{ ...base, libraries: ['electron'] },
		{ ...base, libraries: 'three' },
		{ ...base, artifacts: undefined },
		{ ...base, artifacts: { main: '' } },
		{ ...base, artifacts: { main: 'a.js', slate: 5 } },
		{ ...base, surfaces: { canvas: true } },
		{ ...base, surfaces: { canvas: false, slate: false } },
		{ ...base, parameters: undefined },
		{ ...base, parameters: [] },
		{ ...base, parameters: { amp: 'x' } },
		{ ...base, privateCallbacks: null },
		{ ...base, outputs: { o: { id: 'o' } } },
		{ ...base, inspectorTree: undefined },
		{ ...base, inspectorTree: { elements: [null] } },
		{ ...base, description: 7 },
		{ ...base, tags: 'x' },
		{ ...base, catalogEntryId: 'not-the-derived-id' }
	];
	for (const c of malformed) {
		assert.doesNotThrow(() => validateCatalogEntry(c), `input: ${JSON.stringify(c)}`);
		assert.equal(validateCatalogEntry(c).ok, false, `input must be rejected: ${JSON.stringify(c)}`);
	}
});

test('Catalog Entry identity validation remains total for lone UTF-16 surrogates', () => {
	const entry = buildValidCatalogEntry();
	entry.source = { kind: 'web', sourceId: '\uD800' };
	entry.projectId = '\uDFFF';
	entry.catalogEntryId = catalogEntryId(entry.source, entry.projectId);
	assert.doesNotThrow(() => validateCatalogEntry(entry));
	assert.equal(validateCatalogEntry(entry).ok, true);
});

test('Catalog Entry with an invalid source fails without throwing during identity derivation', () => {
	const entry = buildValidCatalogEntry();
	(entry as unknown as Record<string, unknown>)['source'] = { kind: 'web' };
	// Previously catalogEntryId() was called on the unvalidated source and threw.
	assert.doesNotThrow(() => validateCatalogEntry(entry));
	assert.equal(validateCatalogEntry(entry).ok, false);
});

test('Catalog Entry rejects undefined object properties as non-JSON-safe', () => {
	const entry = buildValidCatalogEntry();
	(entry as unknown as Record<string, unknown>)['description'] = undefined;
	const r = validateCatalogEntry(entry);
	assert.equal(r.ok, false);
	if (!r.ok) assert.ok(r.diagnostics.some((d) => d.code === 'serialization/undefined'));
});

test('Catalog Entry rejects NaN/Infinity as non-JSON-safe values', () => {
	const entry = buildValidCatalogEntry();
	(entry.parameters.amplitude as { default: number }).default = NaN;
	const r1 = validateCatalogEntry(entry);
	assert.equal(r1.ok, false);
	if (!r1.ok) assert.ok(r1.diagnostics.some((d) => d.code === 'serialization/non-finite'));

	const diags = collectSerializationDiagnostics({ nested: { value: Infinity } }, []);
	assert.ok(diags.some((d) => d.code === 'serialization/non-finite'));
	assert.ok(assertSerializable({ a: undefined }).some((d) => d.code === 'serialization/undefined'));
});
