export const OUTPUT_SIZE = 512;

export const RESOLUTION_OPTIONS = [128, 256, 512] as const;

export type SimulationResolution = (typeof RESOLUTION_OPTIONS)[number];

export interface ShallowWaterParameters {
	resolution: SimulationResolution;
	amplitude: number;
	waveSpeed: number;
	damping: number;
	edgeAbsorb: number;
	stepsPerFrame: number;
	contrast: number;
	invert: boolean;
}

export function createDefaultShallowWaterParameters(): ShallowWaterParameters {
	return {
		resolution: 256,
		amplitude: 0.45,
		waveSpeed: 0.16,
		damping: 0.992,
		edgeAbsorb: 22,
		stepsPerFrame: 2,
		contrast: 1.8,
		invert: false
	};
}

export function clampResolution(value: number): SimulationResolution {
	if (value <= 128) return 128;
	if (value >= 512) return 512;
	return 256;
}

export function normalizeParameters(parameters: ShallowWaterParameters): ShallowWaterParameters {
	return {
		resolution: clampResolution(parameters.resolution),
		amplitude: clampNumber(parameters.amplitude, 0, 2),
		waveSpeed: clampNumber(parameters.waveSpeed, 0, 0.35),
		damping: clampNumber(parameters.damping, 0.9, 0.999),
		edgeAbsorb: clampNumber(parameters.edgeAbsorb, 0, 96),
		stepsPerFrame: Math.round(clampNumber(parameters.stepsPerFrame, 1, 8)),
		contrast: clampNumber(parameters.contrast, 0.25, 6),
		invert: parameters.invert
	};
}

function clampNumber(value: number, min: number, max: number): number {
	if (!Number.isFinite(value)) return min;
	return Math.min(max, Math.max(min, value));
}