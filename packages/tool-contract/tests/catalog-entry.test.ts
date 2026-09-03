import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
	collectSerializationDiagnostics,
	validateCatalogEntry,
	catalogEntryId,
	ID_PATTERN
} from '../src/index.ts';

import { buildValidCatalogEntry } from './helpers.ts';

test('a fully-built Catalog Entry validates and is JSON-serializable', () => {
	const entry = buildValidCatalogEntry();
	const r = validateCatalogEntry(entry);
	assert.equal(r.ok, true, JSON.stringify(r.ok ? null : r.diagnostics, null, 2));
	const roundTrip = JSON.parse(JSON.stringify(entry));
	assert.deepEqual(roundTrip, entry);
});

test('Catalog Entry rejects functions anywhere', () => {
	const entry = buildValidCatalogEntry();
	(entry as unknown as Record<string, unknown>)['sneaky'] = () => {};
	const r = validateCatalogEntry(entry);
	assert.equal(r.ok, false);
	if (!r.ok) assert.ok(r.diagnostics.some((d) => d.code === 'serialization/function'));
});

test('Catalog Entry rejects class/library instances (non-plain prototypes)', () => {
	const diags = collectSerializationDiagnostics({ bad: new Date() }, []);
	assert.ok(diags.some((d) => d.code === 'serialization/prototype'));

	// A fake Three-like object must be rejected too.
	class FakeMatrix4 {
		elements = [1, 0, 0, 0];
	}
	const entry = buildValidCatalogEntry();
	(entry as unknown as Record<string, unknown>)['libraryObject'] = new FakeMatrix4();
	const r = validateCatalogEntry(entry);
	assert.equal(r.ok, false);
	if (!r.ok) assert.ok(r.diagnostics.some((d) => d.code === 'serialization/prototype'));
});

test('stable IDs must match the camelCase pattern', () => {
	assert.equal(ID_PATTERN.test('resimulate'), true);
	assert.equal(ID_PATTERN.test('heightMap'), true);
	assert.equal(ID_PATTERN.test('bad id'), false);
	assert.equal(ID_PATTERN.test('BadId'), false);
	assert.equal(ID_PATTERN.test(''), false);
});

test('catalogEntryId must equal catalogEntryId(source, projectId)', () => {
	const entry = buildValidCatalogEntry();
	assert.equal(entry.catalogEntryId, catalogEntryId(entry.source, entry.projectId));
});

test('surfaces.slate must agree with artifacts.slate', () => {
	const entry = buildValidCatalogEntry();
	entry.surfaces.slate = false;
	entry.artifacts.slate = 'slate.js';
	const r = validateCatalogEntry(entry);
	assert.equal(r.ok, false);
	if (!r.ok) assert.ok(r.diagnostics.some((d) => d.code === 'catalog/surface-mismatch'));
});
