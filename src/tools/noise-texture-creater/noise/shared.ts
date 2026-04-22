export const PREVIEW_SIZE = 512;

export type NoiseFamily = 'perlin' | 'voronoi';

export interface SharedNoiseParameters {
	seed: number;
	scale: number;
	offsetX: number;
	offsetY: number;
	brightness: number;
	contrast: number;
}

export interface PerlinNoiseParameters {
	octaves: number;
	persistence: number;
	lacunarity: number;
	exponent: number;
}

export interface VoronoiNoiseParameters {
	cellDensity: number;
	jitter: number;
	edgeWidth: number;
	edgeSoftness: number;
	pointRadius: number;
	pointSharpness: number;
	fillStrength: number;
	cellVariation: number;
}

export interface VoronoiPreset {
	id: string;
	label: string;
	description: string;
	parameters: VoronoiNoiseParameters;
}

export interface NoiseToolState {
	activeFamily: NoiseFamily;
	shared: SharedNoiseParameters;
	perlin: PerlinNoiseParameters;
	voronoi: VoronoiNoiseParameters;
}

export interface NoiseRenderResult {
	width: number;
	height: number;
	rgba8: Uint8ClampedArray;
	rgba16: Uint16Array;
	min: number;
	max: number;
	mean: number;
}

export function createDefaultSharedNoiseParameters(): SharedNoiseParameters {
	return {
		seed: 13,
		scale: 6,
		offsetX: 0,
		offsetY: 0,
		brightness: 0,
		contrast: 1
	};
}

export function createDefaultPerlinNoiseParameters(): PerlinNoiseParameters {
	return {
		octaves: 4,
		persistence: 0.5,
		lacunarity: 2,
		exponent: 1.15
	};
}

export function createDefaultVoronoiNoiseParameters(): VoronoiNoiseParameters {
	return {
		cellDensity: 9,
		jitter: 0.2,
		edgeWidth: 0.02,
		edgeSoftness: 0.28,
		pointRadius: 1.32,
		pointSharpness: 0.78,
		fillStrength: 0.02,
		cellVariation: 0.08
	};
}

export const VORONOI_PRESETS: VoronoiPreset[] = [
	{
		id: 'soft-cells',
		label: 'Soft Cells',
		description: 'Low-jitter cloudy blobs with gentle center falloff.',
		parameters: {
			cellDensity: 9,
			jitter: 0.2,
			edgeWidth: 0.02,
			edgeSoftness: 0.28,
			pointRadius: 1.32,
			pointSharpness: 0.78,
			fillStrength: 0.02,
			cellVariation: 0.08
		}
	},
	{
		id: 'sharp-cells',
		label: 'Sharp Cells',
		description: 'Crisper borders with flatter interiors and stronger breakup.',
		parameters: {
			cellDensity: 12,
			jitter: 0.52,
			edgeWidth: 0.08,
			edgeSoftness: 0.035,
			pointRadius: 0.82,
			pointSharpness: 2.9,
			fillStrength: 0.48,
			cellVariation: 0.32
		}
	},
	{
		id: 'pebbles',
		label: 'Pebbles',
		description: 'Rounder islands with sparse variation and dark seams.',
		parameters: {
			cellDensity: 9,
			jitter: 0.12,
			edgeWidth: 0.015,
			edgeSoftness: 0.18,
			pointRadius: 1.42,
			pointSharpness: 1.55,
			fillStrength: 0,
			cellVariation: 0.08
		}
	},
	{
		id: 'foam',
		label: 'Foam',
		description: 'Dense jittered cells with softer interiors and more tonal spread.',
		parameters: {
			cellDensity: 16,
			jitter: 0.88,
			edgeWidth: 0.03,
			edgeSoftness: 0.16,
			pointRadius: 1.08,
			pointSharpness: 0.92,
			fillStrength: 0.2,
			cellVariation: 0.58
		}
	}
];

export function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

export function clamp01(value: number): number {
	return clamp(value, 0, 1);
}

export function clampInt(value: number, min: number, max: number): number {
	if (!Number.isFinite(value)) {
		return min;
	}

	return Math.round(clamp(value, min, max));
}

export function fract(value: number): number {
	return value - Math.floor(value);
}

export function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
	const width = edge1 - edge0;
	if (width <= 0) {
		return x < edge0 ? 0 : 1;
	}

	const t = clamp01((x - edge0) / width);
	return t * t * (3 - 2 * t);
}

export function hashCoordinates(x: number, y: number, seed: number): number {
	let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);
	value = (value ^ (value >>> 13)) >>> 0;
	value = Math.imul(value, 1274126177) >>> 0;
	return value >>> 0;
}

export function randomUnitFloat(x: number, y: number, seed: number): number {
	return hashCoordinates(x, y, seed) / 4294967295;
}