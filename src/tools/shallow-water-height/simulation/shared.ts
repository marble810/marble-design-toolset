import { createPresetInitMapKey, type PresetInitMapDescriptor } from '$lib/runtime/preset-init-map.js';

export * from './parameters.js';

export const INIT_MAP_SOURCE_MODES = ['preset', 'image'] as const;

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

export function createInitMapSourceKey(source: ShallowWaterInitMapSource): string {
	return source.kind === 'image'
		? `image|${source.objectUrl}`
		: `preset|${createPresetInitMapKey(source.preset)}`;
}
