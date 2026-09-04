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
import { PRESET_INIT_MAP_KINDS, PRESET_INIT_MAP_MODES } from './preset-init-map.ts';

export const RESOLUTION_OPTIONS = ['128', '256', '512', '1024', '2048'] as const;
export const SOURCE_MODE_OPTIONS = ['preset', 'image'] as const;
export const PRESET_KIND_OPTIONS = PRESET_INIT_MAP_KINDS;
export const PRESET_MODE_OPTIONS = PRESET_INIT_MAP_MODES;

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

function clampNumber(value: number, min: number, max: number): number {
	if (!Number.isFinite(value)) return min;
	return Math.min(max, Math.max(min, value));
}

/**
 * Raw-snapshot readers: fallbacks and bounds derive from the Parameter definitions
 * themselves, so a default/constraint change has exactly one place to edit.
 */
export function readNumber(values: Readonly<Record<string, unknown>>, id: string): number {
	const definition = PARAMETER_DEFINITIONS[id];
	if (definition === undefined || definition.type !== 'number' || definition.constraint.type !== 'number') return 0;
	const raw = values[id];
	const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : (definition.default as number);
	return clampNumber(value, definition.constraint.min, definition.constraint.max);
}

export function readBoolean(values: Readonly<Record<string, unknown>>, id: string): boolean {
	const raw = values[id];
	if (typeof raw === 'boolean') return raw;
	const definition = PARAMETER_DEFINITIONS[id];
	return definition !== undefined && typeof definition.default === 'boolean' ? definition.default : false;
}

export function readOption<T extends string>(values: Readonly<Record<string, unknown>>, id: string, options: readonly T[]): T {
	const raw = values[id];
	if (options.includes(raw as T)) return raw as T;
	const definition = PARAMETER_DEFINITIONS[id];
	return definition !== undefined && typeof definition.default === 'string' && options.includes(definition.default as T)
		? (definition.default as T)
		: options[0];
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
	const resolution = clampResolution(Number.parseInt(readOption(values, 'resolution', RESOLUTION_OPTIONS), 10));
	return {
		resolution,
		amplitude: readNumber(values, 'amplitude'),
		waveSpeed: readNumber(values, 'waveSpeed'),
		flowX: readNumber(values, 'flowX'),
		flowY: readNumber(values, 'flowY'),
		distortStrength: readNumber(values, 'distortStrength'),
		distortScale: readNumber(values, 'distortScale'),
		distortSpeed: readNumber(values, 'distortSpeed'),
		damping: readNumber(values, 'damping'),
		edgeAbsorb: readNumber(values, 'edgeAbsorb'),
		restThreshold: readNumber(values, 'restThreshold'),
		stepsPerFrame: Math.round(readNumber(values, 'stepsPerFrame')),
		contrast: readNumber(values, 'contrast'),
		invert: readBoolean(values, 'invert')
	};
}

/** Values that change the initial height field (re-seeding is required). */
export function structuralSimKey(sim: SimParameters, sourceKey: string, resimulateToken: number): string {
	return [sourceKey, sim.resolution, sim.amplitude, sim.invert, resimulateToken].join('|');
}
