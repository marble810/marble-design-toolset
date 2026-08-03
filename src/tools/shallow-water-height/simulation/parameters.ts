export const RESOLUTION_OPTIONS = [128, 256, 512, 1024, 2048] as const;

export type SimulationResolution = (typeof RESOLUTION_OPTIONS)[number];

export interface ShallowWaterParameters {
	resolution: SimulationResolution;
	amplitude: number;
	waveSpeed: number;
	flowX: number;
	flowY: number;
	distortStrength: number;
	distortScale: number;
	distortSpeed: number;
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
		flowX: 0,
		flowY: 0,
		distortStrength: 0,
		distortScale: 4,
		distortSpeed: 0.01,
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
		flowX: clampNumber(parameters.flowX, -1, 1, 0),
		flowY: clampNumber(parameters.flowY, -1, 1, 0),
		distortStrength: clampNumber(parameters.distortStrength, 0, 1),
		distortScale: clampNumber(parameters.distortScale, 0.5, 12),
		distortSpeed: clampNumber(parameters.distortSpeed, 0, 0.05),
		damping: clampNumber(parameters.damping, 0.9, 0.999),
		edgeAbsorb: clampNumber(parameters.edgeAbsorb, 0, 1),
		restThreshold: clampNumber(parameters.restThreshold, 0, 0.01),
		stepsPerFrame: Math.round(clampNumber(parameters.stepsPerFrame, 1, 8)),
		contrast: clampNumber(parameters.contrast, 0.25, 6),
		invert: parameters.invert
	};
}

export function resolveDistortPhase(
	simulationStep: number,
	distortSpeed: number,
	resolutionScale: number
): number {
	return simulationStep * distortSpeed / resolutionScale;
}

function clampNumber(value: number, min: number, max: number, fallback = min): number {
	if (!Number.isFinite(value)) return fallback;
	return Math.min(max, Math.max(min, value));
}
