import assert from 'node:assert/strict';
import test from 'node:test';
import { generateNoiseTexture, sanitizeNoiseToolState } from './controller.ts';
import { sampleVoronoiNoise } from './generators/voronoi-noise.ts';
import {
	createDefaultPerlinNoiseParameters,
	createDefaultSharedNoiseParameters,
	createDefaultVoronoiNoiseParameters,
	type NoiseToolState
} from './shared.ts';

function createBaseState(): NoiseToolState {
	return {
		activeFamily: 'perlin',
		shared: createDefaultSharedNoiseParameters(),
		perlin: createDefaultPerlinNoiseParameters(),
		voronoi: createDefaultVoronoiNoiseParameters()
	};
}

test('sanitizeNoiseToolState clamps shared and family-specific values into supported ranges', () => {
	const sanitized = sanitizeNoiseToolState({
		activeFamily: 'perlin',
		shared: {
			seed: -20,
			scale: 100,
			offsetX: -99,
			offsetY: 99,
			brightness: 4,
			contrast: -1
		},
		perlin: {
			octaves: 100,
			persistence: 5,
			lacunarity: 0,
			exponent: -3
		},
		voronoi: {
			cellDensity: -2,
			jitter: 5,
			edgeWidth: 0,
			edgeSoftness: 5,
			pointRadius: -1,
			pointSharpness: 99,
			fillStrength: -2,
			cellVariation: 3
		}
	});

	assert.deepEqual(sanitized.shared, {
		seed: 0,
		scale: 18,
		offsetX: -4,
		offsetY: 4,
		brightness: 0.5,
		contrast: 0.2
	});
	assert.deepEqual(sanitized.perlin, {
		octaves: 8,
		persistence: 0.95,
		lacunarity: 1.2,
		exponent: 0.4
	});
	assert.deepEqual(sanitized.voronoi, {
		cellDensity: 2,
		jitter: 1,
		edgeWidth: 0.01,
		edgeSoftness: 0.4,
		pointRadius: 0.2,
		pointSharpness: 4,
		fillStrength: 0,
		cellVariation: 1
	});
});

test('generateNoiseTexture returns square 8-bit and 16-bit buffers for both supported families', () => {
	const perlinResult = generateNoiseTexture(createBaseState(), 32);
	const voronoiResult = generateNoiseTexture(
		{ ...createBaseState(), activeFamily: 'voronoi' },
		32
	);

	assert.equal(perlinResult.width, 32);
	assert.equal(perlinResult.height, 32);
	assert.equal(perlinResult.rgba8.length, 32 * 32 * 4);
	assert.equal(perlinResult.rgba16.length, 32 * 32 * 4);
	assert.ok(perlinResult.min >= 0 && perlinResult.max <= 1);
	assert.ok(voronoiResult.min >= 0 && voronoiResult.max <= 1);
	assert.notDeepEqual(
		Array.from(perlinResult.rgba8.slice(0, 128)),
		Array.from(voronoiResult.rgba8.slice(0, 128))
	);
});

test('sampleVoronoiNoise creates a smooth point-to-edge falloff instead of flat cell shards', () => {
	const shared = {
		seed: 13,
		scale: 6,
		offsetX: 0,
		offsetY: 0,
		brightness: 0,
		contrast: 1
	};
	const params = {
		cellDensity: 1,
		jitter: 0,
		edgeWidth: 0.01,
		edgeSoftness: 0.2,
		pointRadius: 1,
		pointSharpness: 1,
		fillStrength: 0,
		cellVariation: 0
	};

	const center = sampleVoronoiNoise(0.5, 0.5, shared, params);
	const mid = sampleVoronoiNoise(0.75, 0.5, shared, params);
	const edge = sampleVoronoiNoise(1, 0.5, shared, params);

	assert.ok(center > mid, 'cell center should stay brighter than the mid falloff region');
	assert.ok(mid > edge, 'mid falloff region should stay brighter than the boundary');
	assert.ok(center > 0.95, 'cell center should remain close to white');
	assert.ok(edge < 0.05, 'cell boundary should fade close to black');
});

test('extended Voronoi controls materially change the generated texture', () => {
	const softBlobState = {
		...createBaseState(),
		activeFamily: 'voronoi' as const,
		voronoi: {
			...createDefaultVoronoiNoiseParameters(),
			pointRadius: 1.55,
			pointSharpness: 0.55,
			fillStrength: 0,
			cellVariation: 0
		}
	};
	const filledCellState = {
		...createBaseState(),
		activeFamily: 'voronoi' as const,
		voronoi: {
			...createDefaultVoronoiNoiseParameters(),
			pointRadius: 0.5,
			pointSharpness: 3.4,
			fillStrength: 0.72,
			cellVariation: 0.9
		}
	};

	const softBlobResult = generateNoiseTexture(softBlobState, 32);
	const filledCellResult = generateNoiseTexture(filledCellState, 32);

	assert.notDeepEqual(
		Array.from(softBlobResult.rgba8.slice(0, 256)),
		Array.from(filledCellResult.rgba8.slice(0, 256))
	);
	assert.ok(
		Math.abs(softBlobResult.mean - filledCellResult.mean) > 0.02,
		'extended Voronoi controls should materially change the overall tone distribution'
	);
});