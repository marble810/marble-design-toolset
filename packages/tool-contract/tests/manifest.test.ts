import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateManifest } from '../src/index.ts';

const VALID_MANIFEST = {
	contractVersion: 1,
	projectId: '8f2c1a0e-1111-4222-8333-444455556666',
	slug: 'shallow-water',
	name: 'Shallow Water',
	version: '1.0.0',
	forgeProfile: 'forge-v1',
	libraries: ['three']
};

test('valid Deshelf manifest is accepted', () => {
	const r = validateManifest(VALID_MANIFEST);
	assert.equal(r.ok, true);
	if (r.ok) {
		assert.equal(r.value.projectId, VALID_MANIFEST.projectId);
		assert.equal(r.value.libraries[0], 'three');
	}
});

test('missing Deshelf identity fields are rejected', () => {
	const r = validateManifest({ name: 'Shallow Water' });
	assert.equal(r.ok, false);
	if (!r.ok) {
		assert.ok(r.diagnostics.some((d) => d.code === 'manifest/identity'));
	}
});

test('wrong contractVersion is rejected', () => {
	const r = validateManifest({ ...VALID_MANIFEST, contractVersion: 2 });
	assert.equal(r.ok, false);
	if (!r.ok) assert.ok(r.diagnostics.some((d) => d.code === 'manifest/contract-version'));
});

test('Manifest MUST NOT carry entry/Parameter/Command/Capability/Slate/Export', () => {
	for (const forbidden of ['entry', 'parameters', 'commands', 'capability', 'slate', 'export']) {
		const r = validateManifest({ ...VALID_MANIFEST, [forbidden]: 'x' });
		assert.equal(r.ok, false, `manifest with ${forbidden} should be rejected`);
	}
});

test('slug and version must match shape', () => {
	assert.equal(validateManifest({ ...VALID_MANIFEST, slug: 'Bad Slug' }).ok, false);
	assert.equal(validateManifest({ ...VALID_MANIFEST, version: '1.0' }).ok, false);
});

test('libraries must be supported Framework Library ids', () => {
	assert.equal(validateManifest({ ...VALID_MANIFEST, libraries: ['three', 'pixi'] }).ok, true);
	assert.equal(validateManifest({ ...VALID_MANIFEST, libraries: ['three', 'not-a-library'] }).ok, false);
});
