/**
 * Shallow Water flat Parameter Set.
 *
 * The Host-owned Parameter Store is the only authority for validity: every entry below
 * carries the constraint range the old tool-side `normalizeParameters` enforced. The
 * container reads the parameter snapshot through `readSimParameters`, which maps the
 * store's `ParameterValue` primitives into the renderer's numeric view (select options
 * are strings; the renderer needs numbers). Nothing here mutates Host state.
 */
import type { ParameterDefinition } from '@deshelf/tool-sdk';

export const RESOLUTION_OPTIONS = ['128', '256', '512', '1024', '2048'] as const;
export const SOURCE_MODE_OPTIONS = ['preset', 'image'] as const;
export const PRESET_KIND_OPTIONS = ['circle', 'square', 'horizontal-bar', 'vertical-bar'] as const;
export const PRESET_MODE_OPTIONS = ['fill', 'outline'] as const;

export type SourceMode = (typeof SOURCE_MODE_OPTIONS)[number];
export type PresetKind = (typeof PRESET_KIND_OPTIONS)[number];
export type PresetMode = (typeof PRESET_MODE_OPTIONS)[number];

/** Flat Parameter definitions, keyed by stable ID (the Tool Entry `parameters` map). */
export const PARAMETER_DEFINITIONS: Record<string, ParameterDefinition> = {
	sourceMode: {
		type: 'select',
		label: 'Source',
		default: 'preset',
		mode: 'manual',
		constraint: { type: 'select', options: SOURCE_MODE_OPTIONS }
	},
	presetKind: {
		type: 'select',
		label: 'Preset',
		default: 'circle',
		mode: 'manual',
		constraint: { type: 'select', options: PRESET_KIND_OPTIONS }
	},
	presetMode: {
		type: 'select',
		label: 'Mode',
		default: 'fill',
		mode: 'manual',
		constraint: { type: 'select', options: PRESET_MODE_OPTIONS }
	},
	presetCenterX: {
		type: 'number',
		label: 'Position X',
		default: 0.5,
		mode: 'manual',
		constraint: { type: 'number', min: 0, max: 1, step: 0.01 }
	},
	presetCenterY: {
		type: 'number',
		label: 'Position Y',
		default: 0.5,
		mode: 'manual',
		constraint: { type: 'number', min: 0, max: 1, step: 0.01 }
	},
	presetSize: {
		type: 'number',
		label: 'Size',
		default: 0.34,
		mode: 'manual',
		constraint: { type: 'number', min: 0.02, max: 1, step: 0.01 }
	},
	presetOutlineWidth: {
		type: 'number',
		label: 'Outline Width',
		default: 0.08,
		mode: 'manual',
		constraint: { type: 'number', min: 0.002, max: 0.12, step: 0.002 }
	},
	presetPosition: {
		type: 'number',
		label: 'Position',
		default: 0.5,
		mode: 'manual',
		constraint: { type: 'number', min: 0, max: 1, step: 0.01 }
	},
	presetThickness: {
		type: 'number',
		label: 'Thickness',
		default: 0.18,
		mode: 'manual',
		constraint: { type: 'number', min: 0.01, max: 1, step: 0.01 }
	},
	presetFeather: {
		type: 'number',
		label: 'Feather',
		default: 0.05,
		mode: 'manual',
		constraint: { type: 'number', min: 0, max: 0.5, step: 0.01 }
	},
	resolution: {
		type: 'select',
		label: 'Resolution',
		default: '256',
		mode: 'manual',
		constraint: { type: 'select', options: RESOLUTION_OPTIONS }
	},
	amplitude: {
		type: 'number',
		label: 'Amplitude',
		default: 0.45,
		mode: 'manual',
		constraint: { type: 'number', min: 0, max: 2, step: 0.01 }
	},
	waveSpeed: {
		type: 'number',
		label: 'Wave Speed',
		default: 0.18,
		mode: 'manual',
		constraint: { type: 'number', min: 0, max: 0.35, step: 0.005 }
	},
	flowX: {
		type: 'number',
		label: 'Flow X',
		default: 0,
		mode: 'manual',
		constraint: { type: 'number', min: -1, max: 1, step: 0.01 }
	},
	flowY: {
		type: 'number',
		label: 'Flow Y',
		default: 0,
		mode: 'manual',
		constraint: { type: 'number', min: -1, max: 1, step: 0.01 }
	},
	distortStrength: {
		type: 'number',
		label: 'Distort Strength',
		default: 0,
		mode: 'manual',
		constraint: { type: 'number', min: 0, max: 1, step: 0.01 }
	},
	distortScale: {
		type: 'number',
		label: 'Distort Scale',
		default: 4,
		mode: 'manual',
		constraint: { type: 'number', min: 0.5, max: 12, step: 0.1 }
	},
	distortSpeed: {
		type: 'number',
		label: 'Distort Speed',
		default: 0.01,
		mode: 'manual',
		constraint: { type: 'number', min: 0, max: 0.05, step: 0.001 }
	},
	damping: {
		type: 'number',
		label: 'Damping',
		default: 0.995,
		mode: 'manual',
		constraint: { type: 'number', min: 0.9, max: 0.999, step: 0.001 }
	},
	edgeAbsorb: {
		type: 'number',
		label: 'Edge Absorb',
		default: 0.9,
		mode: 'manual',
		constraint: { type: 'number', min: 0, max: 1, step: 0.01 }
	},
	restThreshold: {
		type: 'number',
		label: 'Rest Threshold',
		default: 0.00003,
		mode: 'manual',
		constraint: { type: 'number', min: 0, max: 0.01, step: 0.00001 }
	},
	stepsPerFrame: {
		type: 'number',
		label: 'Steps / Frame',
		default: 2,
		mode: 'manual',
		constraint: { type: 'number', min: 1, max: 8, step: 1 }
	},
	contrast: {
		type: 'number',
		label: 'Contrast',
		default: 1.8,
		mode: 'manual',
		constraint: { type: 'number', min: 0.25, max: 6, step: 0.05 }
	},
	invert: {
		type: 'boolean',
		label: 'Invert Init Map',
		default: false,
		mode: 'manual',
		constraint: { type: 'boolean' }
	}
};

/** Renderer-facing numeric view of the flat Parameter Set. */
export interface SimParameters {
	resolution: number;
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

function clampNumber(value: number, min: number, max: number, fallback = min): number {
	if (!Number.isFinite(value)) return fallback;
	return Math.min(max, Math.max(min, value));
}

function readNumber(values: Readonly<Record<string, unknown>>, id: string, fallback: number, min: number, max: number): number {
	const raw = values[id];
	return typeof raw === 'number' && Number.isFinite(raw) ? clampNumber(raw, min, max) : fallback;
}

function readBoolean(values: Readonly<Record<string, unknown>>, id: string, fallback: boolean): boolean {
	return typeof values[id] === 'boolean' ? (values[id] as boolean) : fallback;
}

function readOption<T extends string>(values: Readonly<Record<string, unknown>>, id: string, options: readonly T[], fallback: T): T {
	return options.includes(values[id] as T) ? (values[id] as T) : fallback;
}

function clampResolution(value: number): number {
	if (value <= 128) return 128;
	if (value <= 256) return 256;
	if (value <= 512) return 512;
	if (value <= 1024) return 1024;
	return 2048;
}

/**
 * Maps the Host Parameter snapshot into the renderer's numeric view. The Store rejects
 * out-of-range writes, so the clamps here only guard against a stale/foreign snapshot.
 */
export function readSimParameters(values: Readonly<Record<string, unknown>>): SimParameters {
	const resolution = clampResolution(
		Number.parseInt(readOption(values, 'resolution', RESOLUTION_OPTIONS, '256'), 10)
	);
	return {
		resolution,
		amplitude: readNumber(values, 'amplitude', 0.45, 0, 2),
		waveSpeed: readNumber(values, 'waveSpeed', 0.18, 0, 0.35),
		flowX: readNumber(values, 'flowX', 0, -1, 1),
		flowY: readNumber(values, 'flowY', 0, -1, 1),
		distortStrength: readNumber(values, 'distortStrength', 0, 0, 1),
		distortScale: readNumber(values, 'distortScale', 4, 0.5, 12),
		distortSpeed: readNumber(values, 'distortSpeed', 0.01, 0, 0.05),
		damping: readNumber(values, 'damping', 0.995, 0.9, 0.999),
		edgeAbsorb: readNumber(values, 'edgeAbsorb', 0.9, 0, 1),
		restThreshold: readNumber(values, 'restThreshold', 0.00003, 0, 0.01),
		stepsPerFrame: Math.round(readNumber(values, 'stepsPerFrame', 2, 1, 8)),
		contrast: readNumber(values, 'contrast', 1.8, 0.25, 6),
		invert: readBoolean(values, 'invert', false)
	};
}

/** Values that change the initial height field (re-seeding is required). */
export function structuralSimKey(sim: SimParameters, sourceKey: string, resimulateToken: number): string {
	return [sourceKey, sim.resolution, sim.amplitude, sim.invert, resimulateToken].join('|');
}
