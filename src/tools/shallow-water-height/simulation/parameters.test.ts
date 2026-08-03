import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
	createDefaultShallowWaterParameters,
	normalizeParameters,
	resolveDistortPhase
} from './parameters.ts';

test('flow parameters default to no advection and normalize to finite conservative ranges', () => {
	const defaults = createDefaultShallowWaterParameters();
	assert.equal(defaults.flowX, 0);
	assert.equal(defaults.flowY, 0);
	assert.equal(defaults.distortStrength, 0);

	const normalized = normalizeParameters({
		...defaults,
		flowX: Number.NaN,
		flowY: 4,
		distortStrength: 3,
		distortScale: 0,
		distortSpeed: Number.POSITIVE_INFINITY
	});

	assert.equal(normalized.flowX, 0);
	assert.equal(normalized.flowY, 1);
	assert.equal(normalized.distortStrength, 1);
	assert.equal(normalized.distortScale, 0.5);
	assert.equal(normalized.distortSpeed, 0);
});

test('distort phase is deterministic and resolution-normalized', () => {
	assert.equal(resolveDistortPhase(8, 0.01, 0.5), 0.16);
	assert.equal(resolveDistortPhase(16, 0.01, 1), 0.16);
	assert.equal(resolveDistortPhase(32, 0.01, 2), 0.16);
	assert.equal(resolveDistortPhase(0, 0.01, 2), 0);
});

test('rest threshold checks motion and clears both wave history layers', async () => {
	const source = await readFile(new URL('./wave-renderer.ts', import.meta.url), 'utf8');
	assert.match(
		source,
		/abs\(nextHeight - previousHeight\)[\s\S]*if \(restMotion < restThreshold\)[\s\S]*nextHeight = 0\.0;[\s\S]*previousHeight = 0\.0;/
	);
});
