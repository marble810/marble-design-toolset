import { test } from 'node:test';
import assert from 'node:assert/strict';

import { catalogEntryId } from '../src/index.ts';

const PROJECT_ID = '8f2c1a0e-1111-4222-8333-444455556666';

test('catalogEntryId is deterministic for the same source and project', () => {
	const a = catalogEntryId({ kind: 'web', sourceId: 'site' }, PROJECT_ID);
	const b = catalogEntryId({ kind: 'web', sourceId: 'site' }, PROJECT_ID);
	assert.equal(a, b);
	assert.equal(typeof a, 'string');
	assert.ok(a.length > 0);
});

test('two desktop locations with the same Project ID get different ids', () => {
	const a = catalogEntryId({ kind: 'desktop', projectLocationId: 'loc-A' }, PROJECT_ID);
	const b = catalogEntryId({ kind: 'desktop', projectLocationId: 'loc-B' }, PROJECT_ID);
	assert.notEqual(a, b);
});

test('web and desktop sources never collide for the same project', () => {
	const web = catalogEntryId({ kind: 'web', sourceId: 'site' }, PROJECT_ID);
	const desktop = catalogEntryId({ kind: 'desktop', projectLocationId: 'site' }, PROJECT_ID);
	assert.notEqual(web, desktop);
});

test('different projects never share a catalogEntryId', () => {
	const a = catalogEntryId({ kind: 'web', sourceId: 'site' }, 'project-A');
	const b = catalogEntryId({ kind: 'web', sourceId: 'site' }, 'project-B');
	assert.notEqual(a, b);
});

test('source and project components containing separators cannot collide', () => {
	const a = catalogEntryId({ kind: 'web', sourceId: 'a/b' }, 'c');
	const b = catalogEntryId({ kind: 'web', sourceId: 'a' }, 'b/c');
	assert.notEqual(a, b);
});

test('catalogEntryId is total for arbitrary UTF-16 strings', () => {
	assert.doesNotThrow(() => catalogEntryId({ kind: 'web', sourceId: '\uD800' }, '\uDFFF'));
	const a = catalogEntryId({ kind: 'web', sourceId: '\uD800' }, 'x');
	const b = catalogEntryId({ kind: 'web', sourceId: '' }, '\uD800x');
	assert.notEqual(a, b);
});
