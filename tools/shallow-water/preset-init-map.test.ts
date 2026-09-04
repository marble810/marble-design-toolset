import { describe, expect, test } from 'bun:test';
import {
	createDefaultPresetInitMap,
	createPresetInitMapKey,
	normalizePresetInitMap,
	presetFromParameterValues,
	renderPresetInitMap
} from './preset-init-map.ts';

function average(values: Float32Array): number {
	let total = 0;
	for (const value of values) {
		total += value;
	}
	return total / values.length;
}

describe('preset init map', () => {
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

		expect(normalized.mode).toBe('outline');
		if (normalized.kind === 'circle' || normalized.kind === 'square') {
			expect(normalized.outlineWidth).toBeLessThan(normalized.size);
		}
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

		expect(Array.from(first)).toEqual(Array.from(second));
		expect(createPresetInitMapKey(preset)).toBe(createPresetInitMapKey(preset));
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

		expect(data[centerIndex]).toBeLessThan(0.05);
		expect(data[ringIndex]).toBeGreaterThan(0.75);
	});

	test('horizontal bar coverage stays close across output resolutions', () => {
		const preset = normalizePresetInitMap({
			kind: 'horizontal-bar',
			position: 0.5,
			thickness: 0.18,
			feather: 0.04
		});

		const lowAverage = average(renderPresetInitMap(preset, 64, 64));
		const highAverage = average(renderPresetInitMap(preset, 256, 256));

		expect(Math.abs(lowAverage - highAverage)).toBeLessThan(0.02);
	});

	test('createDefaultPresetInitMap provides a filled circle by default', () => {
		const preset = createDefaultPresetInitMap();
		expect(preset.kind).toBe('circle');
		expect(preset.mode).toBe('fill');
	});

	test('presetFromParameterValues rebuilds the descriptor from the flat Parameter Set', () => {
		const shape = presetFromParameterValues({
			presetKind: 'square',
			presetMode: 'outline',
			presetCenterX: 0.25,
			presetCenterY: 0.75,
			presetSize: 0.4,
			presetFeather: 0.02,
			presetOutlineWidth: 0.5
		});
		expect(shape.kind).toBe('square');
		if (shape.kind === 'square') {
			expect(shape.mode).toBe('outline');
			expect(shape.centerX).toBe(0.25);
			// The outline width derives from the size (legacy derived constraint).
			expect(shape.outlineWidth).toBeLessThanOrEqual(shape.size * 0.5);
		}

		const bar = presetFromParameterValues({
			presetKind: 'vertical-bar',
			presetPosition: 0.3,
			presetThickness: 0.2,
			presetFeather: 0.01
		});
		expect(bar.kind).toBe('vertical-bar');
		if (bar.kind === 'vertical-bar') {
			expect(bar.position).toBe(0.3);
			expect(bar.thickness).toBe(0.2);
		}

		// Unknown values fall back to the circle default.
		expect(presetFromParameterValues({ presetKind: 'triangle' }).kind).toBe('circle');
	});
});
