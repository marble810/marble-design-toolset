import { samplePerlinNoise } from './generators/perlin-noise.ts';
import { sampleVoronoiNoise } from './generators/voronoi-noise.ts';
import {
	PREVIEW_SIZE,
	clamp,
	clamp01,
	clampInt,
	type NoiseRenderResult,
	type NoiseToolState,
	type PerlinNoiseParameters,
	type SharedNoiseParameters,
	type VoronoiNoiseParameters
} from './shared.ts';

function sanitizeShared(shared: SharedNoiseParameters): SharedNoiseParameters {
	return {
		seed: clampInt(shared.seed, 0, 9999),
		scale: clamp(shared.scale, 0.5, 18),
		offsetX: clamp(shared.offsetX, -4, 4),
		offsetY: clamp(shared.offsetY, -4, 4),
		brightness: clamp(shared.brightness, -0.5, 0.5),
		contrast: clamp(shared.contrast, 0.2, 2.4)
	};
}

function sanitizePerlin(perlin: PerlinNoiseParameters): PerlinNoiseParameters {
	return {
		octaves: clampInt(perlin.octaves, 1, 8),
		persistence: clamp(perlin.persistence, 0.1, 0.95),
		lacunarity: clamp(perlin.lacunarity, 1.2, 4),
		exponent: clamp(perlin.exponent, 0.4, 3)
	};
}

function sanitizeVoronoi(voronoi: VoronoiNoiseParameters): VoronoiNoiseParameters {
	return {
		cellDensity: clampInt(voronoi.cellDensity, 2, 48),
		jitter: clamp(voronoi.jitter, 0, 1),
		edgeWidth: clamp(voronoi.edgeWidth, 0.01, 0.4),
		edgeSoftness: clamp(voronoi.edgeSoftness, 0.001, 0.4),
		pointRadius: clamp(voronoi.pointRadius, 0.2, 1.8),
		pointSharpness: clamp(voronoi.pointSharpness, 0.4, 4),
		fillStrength: clamp(voronoi.fillStrength, 0, 1),
		cellVariation: clamp(voronoi.cellVariation, 0, 1)
	};
}

export function sanitizeNoiseToolState(state: NoiseToolState): NoiseToolState {
	return {
		activeFamily: state.activeFamily === 'voronoi' ? 'voronoi' : 'perlin',
		shared: sanitizeShared(state.shared),
		perlin: sanitizePerlin(state.perlin),
		voronoi: sanitizeVoronoi(state.voronoi)
	};
}

function applyTone(shared: SharedNoiseParameters, value: number): number {
	const contrasted = (value - 0.5) * shared.contrast + 0.5;
	return clamp01(contrasted + shared.brightness);
}

export function generateNoiseTexture(
	state: NoiseToolState,
	size = PREVIEW_SIZE
): NoiseRenderResult {
	const normalized = sanitizeNoiseToolState(state);
	const width = clampInt(size, 1, PREVIEW_SIZE);
	const height = width;
	const rgba8 = new Uint8ClampedArray(width * height * 4);
	const rgba16 = new Uint16Array(width * height * 4);

	let min = 1;
	let max = 0;
	let total = 0;

	const widthDenominator = Math.max(1, width - 1);
	const heightDenominator = Math.max(1, height - 1);

	for (let y = 0; y < height; y += 1) {
		const sampleY = y / heightDenominator;
		for (let x = 0; x < width; x += 1) {
			const sampleX = x / widthDenominator;
			const rawValue =
				normalized.activeFamily === 'perlin'
					? samplePerlinNoise(sampleX, sampleY, normalized.shared, normalized.perlin)
					: sampleVoronoiNoise(sampleX, sampleY, normalized.shared, normalized.voronoi);

			const value = applyTone(normalized.shared, rawValue);
			const color8 = Math.round(value * 255);
			const color16 = Math.round(value * 65535);
			const pixelIndex = (y * width + x) * 4;

			rgba8[pixelIndex] = color8;
			rgba8[pixelIndex + 1] = color8;
			rgba8[pixelIndex + 2] = color8;
			rgba8[pixelIndex + 3] = 255;

			rgba16[pixelIndex] = color16;
			rgba16[pixelIndex + 1] = color16;
			rgba16[pixelIndex + 2] = color16;
			rgba16[pixelIndex + 3] = 65535;

			min = Math.min(min, value);
			max = Math.max(max, value);
			total += value;
		}
	}

	return {
		width,
		height,
		rgba8,
		rgba16,
		min,
		max,
		mean: total / (width * height)
	};
}