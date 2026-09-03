import { test } from 'node:test';
import assert from 'node:assert/strict';

import duplicateId from '../fixtures/duplicate-id.ts';
import invalidId from '../fixtures/invalid-id.ts';
import { evaluateToolDefinition } from '../src/extract.ts';
import { inputFor } from './helpers.ts';

test('a stable ID shared by two maps is a duplicate and fails extraction', () => {
	const result = evaluateToolDefinition(inputFor(duplicateId));
	assert.equal(result.ok, false);
	assert.equal(result.entry, undefined);
	if (!result.ok) {
		assert.ok(result.diagnostics.some((d) => d.code === 'id/duplicate'), JSON.stringify(result.diagnostics, null, 2));
	}
});

test('an invalid map key is rejected as an invalid stable ID', () => {
	const result = evaluateToolDefinition(inputFor(invalidId));
	assert.equal(result.ok, false);
	assert.equal(result.entry, undefined);
	if (!result.ok) {
		assert.ok(result.diagnostics.some((d) => d.code === 'id/invalid'), JSON.stringify(result.diagnostics, null, 2));
	}
});
