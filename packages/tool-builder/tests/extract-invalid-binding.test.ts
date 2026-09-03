import { test } from 'node:test';
import assert from 'node:assert/strict';

import invalidMissing from '../fixtures/invalid-binding-missing.ts';
import invalidInline from '../fixtures/invalid-binding-inline.ts';
import { evaluateToolDefinition } from '../src/extract.ts';
import { inputFor } from './helpers.ts';

test('binding an undeclared private callback fails extraction', () => {
	const result = evaluateToolDefinition(inputFor(invalidMissing));
	assert.equal(result.ok, false);
	assert.equal(result.entry, undefined);
	assert.ok(result.diagnostics.length > 0);
});

test('binding an inline anonymous callback fails extraction', () => {
	const result = evaluateToolDefinition(inputFor(invalidInline));
	assert.equal(result.ok, false);
	assert.equal(result.entry, undefined);
	if (!result.ok) {
		assert.ok(
			result.diagnostics.some((d) => d.code === 'inspector/extraction-failed'),
			JSON.stringify(result.diagnostics, null, 2)
		);
	}
});
