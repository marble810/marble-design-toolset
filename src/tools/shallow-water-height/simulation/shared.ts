import { createPresetInitMapKey, type PresetInitMapDescriptor } from '$lib/runtime/preset-init-map.js';

export const RESOLUTION_OPTIONS = [128, 256, 512, 1024, 2048] as const;
export const INIT_MAP_SOURCE_MODES = ['preset', 'image'] as const;

export type SimulationResolution = (typeof RESOLUTION_OPTIONS)[number];
export type InitMapSourceMode = (typeof INIT_MAP_SOURCE_MODES)[number];

export type ShallowWaterInitMapSource =
	| {
			kind: 'image';
			objectUrl: string;
	  }
	| {
			kind: 'preset';
			preset: PresetInitMapDescriptor;
	  };

export interface ShallowWaterParameters {
	resolution: SimulationResolution;
	amplitude: number;
	waveSpeed: number;
	damping: number;
	edgeAbsorb: number;
	restThreshold: number;
	stepsPerFrame: number;
	contrast: number;
	invert: boolean;
}

export function createDefaultShallowWaterParameters(): ShallowWaterParameters {
	return {
		resolution: 256,
		amplitude: 0.45,
		waveSpeed: 0.18,
		damping: 0.995,
		edgeAbsorb: 0.9,
		restThreshold: 0.00003,
		stepsPerFrame: 2,
		contrast: 1.8,
		invert: false
	};
}

export function clampResolution(value: number): SimulationResolution {
	if (value <= 128) return 128;
	if (value <= 256) return 256;
	if (value <= 512) return 512;
	if (value <= 1024) return 1024;
	return 2048;
}

export function normalizeParameters(parameters: ShallowWaterParameters): ShallowWaterParameters {
	return {
		resolution: clampResolution(parameters.resolution),
		amplitude: clampNumber(parameters.amplitude, 0, 2),
		waveSpeed: clampNumber(parameters.waveSpeed, 0, 0.35),
		damping: clampNumber(parameters.damping, 0.9, 0.999),
		edgeAbsorb: clampNumber(parameters.edgeAbsorb, 0, 1),
		restThreshold: clampNumber(parameters.restThreshold, 0, 0.01),
		stepsPerFrame: Math.round(clampNumber(parameters.stepsPerFrame, 1, 8)),
		contrast: clampNumber(parameters.contrast, 0.25, 6),
		invert: parameters.invert
	};
}

export function createInitMapSourceKey(source: ShallowWaterInitMapSource): string {
	return source.kind === 'image'
		? `image|${source.objectUrl}`
		: `preset|${createPresetInitMapKey(source.preset)}`;
}

function clampNumber(value: number, min: number, max: number): number {
	if (!Number.isFinite(value)) return min;
	return Math.min(max, Math.max(min, value));
}