import { test } from 'node:test';
import assert from 'node:assert/strict';

import validEntry from '../fixtures/valid-shallow-water.ts';
import invalidInline from '../fixtures/invalid-binding-inline.ts';
import duplicateId from '../fixtures/duplicate-id.ts';
import { DESKTOP_SOURCE, ARTIFACTS, VALID_MANIFEST, PROJECT_ID } from '../fixtures/manifest.ts';
import { CatalogStore, publishToCatalog } from '../src/catalog-store.ts';
import { inputFor } from './helpers.ts';
import { catalogEntryId } from 'tool-contract';

test('successful extraction is published into the Catalog', () => {
	const store = new CatalogStore();
	const { outcome, published } = publishToCatalog(store, inputFor(validEntry));
	assert.equal(outcome.ok, true);
	assert.equal(published, true);
	const entry = store.get(catalogEntryId(DESKTOP_SOURCE, PROJECT_ID));
	assert.ok(entry, 'entry must be findable by its catalogEntryId');
	assert.deepEqual(entry, outcome.entry);
});

test('failed extraction is NOT published into the Catalog', () => {
	for (const bad of [invalidInline, duplicateId]) {
		const store = new CatalogStore();
		const { outcome, published } = publishToCatalog(store, inputFor(bad));
		assert.equal(outcome.ok, false);
		assert.equal(published, false);
		assert.equal(store.list().length, 0, 'failed extraction must not enter the usable Catalog');
	}
});

test('same Project ID at two Locations does not overwrite', () => {
	const store = new CatalogStore();
	publishToCatalog(store, inputFor(validEntry, { source: { kind: 'desktop', projectLocationId: 'loc-A' } }));
	publishToCatalog(store, inputFor(validEntry, { source: { kind: 'desktop', projectLocationId: 'loc-B' } }));

	assert.equal(store.list().length, 2);
	const idA = catalogEntryId({ kind: 'desktop', projectLocationId: 'loc-A' }, PROJECT_ID);
	const idB = catalogEntryId({ kind: 'desktop', projectLocationId: 'loc-B' }, PROJECT_ID);
	assert.ok(store.get(idA));
	assert.ok(store.get(idB));
	assert.notEqual(idA, idB);
});

test('re-publishing the same source replaces only its own Entry', () => {
	const store = new CatalogStore();
	publishToCatalog(store, inputFor(validEntry, { source: { kind: 'desktop', projectLocationId: 'loc-A' } }));
	publishToCatalog(store, inputFor(validEntry, { source: { kind: 'desktop', projectLocationId: 'loc-B' } }));
	publishToCatalog(store, inputFor(validEntry, { source: { kind: 'desktop', projectLocationId: 'loc-B' }, manifest: { ...VALID_MANIFEST, name: 'Renamed' } }));

	assert.equal(store.list().length, 2);
	const idB = catalogEntryId({ kind: 'desktop', projectLocationId: 'loc-B' }, PROJECT_ID);
	const idA = catalogEntryId({ kind: 'desktop', projectLocationId: 'loc-A' }, PROJECT_ID);
	assert.equal(store.get(idB)?.name, 'Renamed');
	assert.equal(store.get(idA)?.name, 'Shallow Water', 'other Location entry must be untouched');
	assert.equal(ARTIFACTS.main, 'shallow-water/main.js');
});
