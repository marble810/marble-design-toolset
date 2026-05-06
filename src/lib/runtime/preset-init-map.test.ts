import assert from 'node:assert/strict';
import test from 'node:test';

import {
	createDefaultPresetInitMap,
	createPresetInitMapKey,
	normalizePresetInitMap,
	renderPresetInitMap
} from './preset-init-map.ts';

test('normalizePresetInitMap clamps outline width below the circle size', () => {
	const normalized = normalizePresetInitMap({
		kind: 'circle',
		centerX: 0.5,
		centerY: 0.5,
		size: 0.2,
		feather: 0.05,
		mode: 'outline',
		outlineWidth: 0.8
	});

	assert.equal(normalized.mode, 'outline');
	assert.ok(normalized.outlineWidth < normalized.size);
});

test('renderPresetInitMap is deterministic for the same preset and size', () => {
	const preset = normalizePresetInitMap({
		kind: 'square',
		centerX: 0.42,
		centerY: 0.58,
		size: 0.36,
		feather: 0.04,
		mode: 'fill',
		outlineWidth: 0.08
	});

	const first = renderPresetInitMap(preset, 64, 64);
	const second = renderPresetInitMap(preset, 64, 64);

	assert.deepEqual(Array.from(first), Array.from(second));
	assert.equal(createPresetInitMapKey(preset), createPresetInitMapKey(preset));
});

test('outlined circle leaves the center hollow while retaining a bright ring', () => {
	const preset = normalizePresetInitMap({
		kind: 'circle',
		centerX: 0.5,
		centerY: 0.5,
		size: 0.5,
		feather: 0.01,
		mode: 'outline',
		outlineWidth: 0.08
	});

	const size = 128;
	const data = renderPresetInitMap(preset, size, size);
	const centerIndex = Math.floor(size * 0.5) * size + Math.floor(size * 0.5);
	const ringIndex = Math.floor(size * 0.5) * size + Math.floor(size * 0.75);

	assert.ok(data[centerIndex] < 0.05);
	assert.ok(data[ringIndex] > 0.75);
});

test('horizontal bar coverage stays close across output resolutions', () => {
	const preset = normalizePresetInitMap({
		kind: 'horizontal-bar',
		position: 0.5,
		thickness: 0.18,
		feather: 0.04
	});

	const lowRes = renderPresetInitMap(preset, 64, 64);
	const highRes = renderPresetInitMap(preset, 256, 256);

	const lowAverage = average(lowRes);
	const highAverage = average(highRes);

	assert.ok(Math.abs(lowAverage - highAverage) < 0.02, `${lowAverage} vs ${highAverage}`);
});

test('createDefaultPresetInitMap provides a filled circle by default', () => {
	const preset = createDefaultPresetInitMap();
	assert.equal(preset.kind, 'circle');
	assert.equal(preset.mode, 'fill');
});

function average(values: Float32Array): number {
	let total = 0;
	for (const value of values) {
		total += value;
	}
	return total / values.length;
}