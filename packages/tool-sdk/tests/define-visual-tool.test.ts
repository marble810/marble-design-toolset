import { test } from 'node:test';
import assert from 'node:assert/strict';

import { defineVisualTool, defineInspectorCallback } from '../src/index.ts';

test('defineVisualTool returns the definition unchanged (no registration, no side effects)', () => {
	const def = {
		parameters: {},
		privateCallbacks: {},
		createInspector() {},
		canvas: () => import('./virtual-canvas.ts')
	};
	const result = defineVisualTool(def);
	assert.equal(result, def);
	assert.deepEqual(result, def);
});

test('defineInspectorCallback returns an opaque tagged definition that RETAINS the run implementation', () => {
	const run = () => 'ran';
	const callback = defineInspectorCallback({ run });
	assert.equal(typeof callback, 'object');
	assert.equal(callback.__deshelfCallbackTag, 'inspector-callback');
	assert.equal(typeof callback.run, 'function', 'the Main-only run implementation must stay on the definition');
	assert.equal(callback.run(), 'ran');
	assert.equal(callback.run, run, 'the definition retains the exact Main-only implementation');
});

test('defineInspectorCallback requires a run function', () => {
	// @ts-expect-error run is required
	assert.throws(() => defineInspectorCallback({}), /run function/);
});

test('defineVisualTool does not accept an entry without privateCallbacks', () => {
	// @ts-expect-error privateCallbacks is required by the SDK contract
	assert.throws(() => defineVisualTool({ parameters: {}, createInspector() {}, canvas: () => import('./virtual-canvas.ts') }));
});
