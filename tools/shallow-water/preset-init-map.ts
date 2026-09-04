export const PRESET_INIT_MAP_KINDS = [
	'circle',
	'square',
	'horizontal-bar',
	'vertical-bar'
] as const;

export type PresetInitMapKind = (typeof PRESET_INIT_MAP_KINDS)[number];
export type PresetInitMapMode = 'fill' | 'outline';

interface CircleSquarePresetBase {
	kind: 'circle' | 'square';
	centerX: number;
	centerY: number;
	size: number;
	feather: number;
	mode: PresetInitMapMode;
	outlineWidth: number;
}

export interface CirclePreset extends CircleSquarePresetBase {
	kind: 'circle';
}

export interface SquarePreset extends CircleSquarePresetBase {
	kind: 'square';
}

export interface HorizontalBarPreset {
	kind: 'horizontal-bar';
	position: number;
	thickness: number;
	feather: number;
}

export interface VerticalBarPreset {
	kind: 'vertical-bar';
	position: number;
	thickness: number;
	feather: number;
}

export type PresetInitMapDescriptor =
	| CirclePreset
	| SquarePreset
	| HorizontalBarPreset
	| VerticalBarPreset;

export function createDefaultPresetInitMap(
	kind: PresetInitMapKind = 'circle'
): PresetInitMapDescriptor {
	switch (kind) {
		case 'circle':
			return {
				kind,
				centerX: 0.5,
				centerY: 0.5,
				size: 0.34,
				feather: 0.05,
				mode: 'fill',
				outlineWidth: 0.08
			};
		case 'square':
			return {
				kind,
				centerX: 0.5,
				centerY: 0.5,
				size: 0.38,
				feather: 0.05,
				mode: 'fill',
				outlineWidth: 0.08
			};
		case 'horizontal-bar':
			return {
				kind,
				position: 0.5,
				thickness: 0.18,
				feather: 0.05
			};
		case 'vertical-bar':
			return {
				kind,
				position: 0.5,
				thickness: 0.18,
				feather: 0.05
			};
	}
}

export function normalizePresetInitMap(
	preset: PresetInitMapDescriptor
): PresetInitMapDescriptor {
	if (preset.kind === 'circle' || preset.kind === 'square') {
		const size = clampNumber(preset.size, 0.02, 1);
		const mode = preset.mode === 'outline' ? 'outline' : 'fill';
		const maxOutlineWidth = Math.max(0.002, Math.min(0.12, size * 0.5));
		return {
			...preset,
			centerX: clampNumber(preset.centerX, 0, 1),
			centerY: clampNumber(preset.centerY, 0, 1),
			size,
			feather: clampNumber(preset.feather, 0, 0.5),
			mode,
			outlineWidth: clampNumber(preset.outlineWidth, 0.002, maxOutlineWidth)
		};
	}

	return {
		...preset,
		position: clampNumber(preset.position, 0, 1),
		thickness: clampNumber(preset.thickness, 0.01, 1),
		feather: clampNumber(preset.feather, 0, 0.5)
	};
}

export function createPresetInitMapKey(preset: PresetInitMapDescriptor): string {
	const normalized = normalizePresetInitMap(preset);
	if (normalized.kind === 'circle' || normalized.kind === 'square') {
		return [
			normalized.kind,
			normalized.mode,
			formatKeyNumber(normalized.centerX),
			formatKeyNumber(normalized.centerY),
			formatKeyNumber(normalized.size),
			formatKeyNumber(normalized.outlineWidth),
			formatKeyNumber(normalized.feather)
		].join('|');
	}

	return [
		normalized.kind,
		formatKeyNumber(normalized.position),
		formatKeyNumber(normalized.thickness),
		formatKeyNumber(normalized.feather)
	].join('|');
}

export function renderPresetInitMap(
	preset: PresetInitMapDescriptor,
	width: number,
	height: number
): Float32Array {
	const normalized = normalizePresetInitMap(preset);
	const data = new Float32Array(width * height);

	for (let y = 0; y < height; y += 1) {
		const v = (y + 0.5) / height;
		for (let x = 0; x < width; x += 1) {
			const u = (x + 0.5) / width;
			const index = y * width + x;
			data[index] = samplePreset(normalized, u, v);
		}
	}

	return data;
}

function samplePreset(preset: PresetInitMapDescriptor, u: number, v: number): number {
	if (preset.kind === 'circle' || preset.kind === 'square') {
		const signedDistance =
			preset.kind === 'circle'
				? sampleCircleSignedDistance(preset, u, v)
				: sampleSquareSignedDistance(preset, u, v);

		return clamp01(
			preset.mode === 'outline'
				? sampleOutlineMask(signedDistance, preset.outlineWidth, preset.feather)
				: sampleFillMask(signedDistance, preset.feather)
		);
	}

	const signedDistance =
		preset.kind === 'horizontal-bar'
			? Math.abs(v - preset.position) - preset.thickness * 0.5
			: Math.abs(u - preset.position) - preset.thickness * 0.5;

	return clamp01(sampleFillMask(signedDistance, preset.feather));
}

function sampleCircleSignedDistance(preset: CirclePreset, u: number, v: number): number {
	return Math.hypot(u - preset.centerX, v - preset.centerY) - preset.size * 0.5;
}

function sampleSquareSignedDistance(preset: SquarePreset, u: number, v: number): number {
	const halfExtent = preset.size * 0.5;
	const deltaX = Math.abs(u - preset.centerX) - halfExtent;
	const deltaY = Math.abs(v - preset.centerY) - halfExtent;
	const outsideDistance = Math.hypot(Math.max(deltaX, 0), Math.max(deltaY, 0));
	const insideDistance = Math.min(Math.max(deltaX, deltaY), 0);
	return outsideDistance + insideDistance;
}

function sampleFillMask(signedDistance: number, feather: number): number {
	if (signedDistance <= 0) {
		return 1;
	}

	if (feather <= 0 || signedDistance >= feather) {
		return 0;
	}

	return 1 - smoothstep(0, feather, signedDistance);
}

function sampleOutlineMask(signedDistance: number, outlineWidth: number, feather: number): number {
	const bandDistance = Math.abs(signedDistance);
	const halfWidth = outlineWidth * 0.5;
	if (bandDistance <= halfWidth) {
		return 1;
	}

	if (feather <= 0 || bandDistance >= halfWidth + feather) {
		return 0;
	}

	return 1 - smoothstep(halfWidth, halfWidth + feather, bandDistance);
}

function smoothstep(edge0: number, edge1: number, value: number): number {
	if (edge0 === edge1) {
		return value < edge0 ? 0 : 1;
	}

	const t = clamp01((value - edge0) / (edge1 - edge0));
	return t * t * (3 - 2 * t);
}

function clampNumber(value: number, min: number, max: number): number {
	if (!Number.isFinite(value)) {
		return min;
	}

	return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
	return clampNumber(value, 0, 1);
}

function formatKeyNumber(value: number): string {
	return value.toFixed(4);
}

/** Reads a finite number out of a raw Parameter snapshot entry. */
function readNumber(values: Readonly<Record<string, unknown>>, id: string, fallback: number): number {
	const raw = values[id];
	return typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback;
}

/** Reads a select option out of a raw Parameter snapshot entry. */
function readOption<T extends string>(
	values: Readonly<Record<string, unknown>>,
	id: string,
	options: readonly T[],
	fallback: T
): T {
	return options.includes(values[id] as T) ? (values[id] as T) : fallback;
}

/**
 * Builds the preset descriptor from the flat Host Parameter values. The Store already
 * rejects out-of-range writes; `normalizePresetInitMap` still clamps the outline width
 * against the preset size (the one derived constraint that lives between two sliders).
 */
export function presetFromParameterValues(values: Readonly<Record<string, unknown>>): PresetInitMapDescriptor {
	const kind = readOption(values, 'presetKind', PRESET_INIT_MAP_KINDS, 'circle');
	if (kind === 'circle' || kind === 'square') {
		return normalizePresetInitMap({
			kind,
			centerX: readNumber(values, 'presetCenterX', 0.5),
			centerY: readNumber(values, 'presetCenterY', 0.5),
			size: readNumber(values, 'presetSize', 0.34),
			feather: readNumber(values, 'presetFeather', 0.05),
			mode: readOption(values, 'presetMode', ['fill', 'outline'] as const, 'fill'),
			outlineWidth: readNumber(values, 'presetOutlineWidth', 0.08)
		});
	}

	return normalizePresetInitMap({
		kind,
		position: readNumber(values, 'presetPosition', 0.5),
		thickness: readNumber(values, 'presetThickness', 0.18),
		feather: readNumber(values, 'presetFeather', 0.05)
	});
}