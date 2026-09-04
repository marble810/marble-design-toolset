/**
 * Retained Standard Inspector tree (extracted into the Catalog at build time).
 *
 * The tree is static; conditional relevance (the old controls component hid preset
 * sliders depending on the source mode and preset kind) is expressed with `visibleWhen`
 * rules that the Host evaluates against the live Parameter Store. Sections nest so a
 * single `equals` condition per level covers the combined cases.
 */
import type { InspectorContext } from '@deshelf/tool-sdk';

const PRESET_SOURCE = { parameterId: 'sourceMode', equals: 'preset' } as const;
const IMAGE_SOURCE = { parameterId: 'sourceMode', equals: 'image' } as const;
const SHAPE_PRESETS = { parameterId: 'presetKind', equals: ['circle', 'square'] } as const;
const BAR_PRESETS = { parameterId: 'presetKind', equals: ['horizontal-bar', 'vertical-bar'] } as const;
const OUTLINE_MODE = { parameterId: 'presetMode', equals: 'outline' } as const;

export function buildInspector({ root, parameters, privateCallbacks }: InspectorContext): void {
	root.section(
		'initMap',
		'Init Map',
		(section) => {
			section.select({ id: 'sourceMode', label: 'Source', bind: parameters.sourceMode });
			section.section(
				'presetShape',
				'Shape Preset',
				(shape) => {
					shape.select({ id: 'presetMode', label: 'Mode', bind: parameters.presetMode });
					shape.slider({ id: 'presetCenterX', label: 'Position X', bind: parameters.presetCenterX });
					shape.slider({ id: 'presetCenterY', label: 'Position Y', bind: parameters.presetCenterY });
					shape.slider({ id: 'presetSize', label: 'Size', bind: parameters.presetSize });
					shape.slider({
						id: 'presetOutlineWidth',
						label: 'Outline Width',
						bind: parameters.presetOutlineWidth,
						visibleWhen: OUTLINE_MODE
					});
				},
				{ visibleWhen: SHAPE_PRESETS }
			);
			section.section(
				'presetBar',
				'Bar Preset',
				(bar) => {
					bar.slider({ id: 'presetPosition', label: 'Position', bind: parameters.presetPosition });
					bar.slider({ id: 'presetThickness', label: 'Thickness', bind: parameters.presetThickness });
				},
				{ visibleWhen: BAR_PRESETS }
			);
			section.slider({ id: 'presetFeather', label: 'Feather', bind: parameters.presetFeather });
			section.label('presetHint', 'The procedural preset is rendered at the simulation resolution.');
		},
		{ visibleWhen: PRESET_SOURCE }
	);
	root.label('imageHint', 'Load an init map image through the Host asset panel.', { visibleWhen: IMAGE_SOURCE });

	root.section('simulation', 'Simulation', (section) => {
		section.select({ id: 'resolution', label: 'Resolution', bind: parameters.resolution });
		section.slider({ id: 'amplitude', label: 'Amplitude', bind: parameters.amplitude });
		section.slider({ id: 'waveSpeed', label: 'Wave Speed', bind: parameters.waveSpeed });
		section.slider({ id: 'flowX', label: 'Flow X', bind: parameters.flowX });
		section.slider({ id: 'flowY', label: 'Flow Y', bind: parameters.flowY });
		section.slider({ id: 'distortStrength', label: 'Distort Strength', bind: parameters.distortStrength });
		section.slider({ id: 'distortScale', label: 'Distort Scale', bind: parameters.distortScale });
		section.slider({ id: 'distortSpeed', label: 'Distort Speed', bind: parameters.distortSpeed });
		section.slider({ id: 'damping', label: 'Damping', bind: parameters.damping });
		section.slider({ id: 'edgeAbsorb', label: 'Edge Absorb', bind: parameters.edgeAbsorb });
		section.slider({ id: 'restThreshold', label: 'Rest Threshold', bind: parameters.restThreshold });
		section.slider({ id: 'stepsPerFrame', label: 'Steps / Frame', bind: parameters.stepsPerFrame });
		section.button({ id: 'resimulate', label: 'Resimulate', bind: privateCallbacks.resimulate });
	});

	root.section('display', 'Display', (section) => {
		section.slider({ id: 'contrast', label: 'Contrast', bind: parameters.contrast });
		section.toggle({ id: 'invert', label: 'Invert Init Map', bind: parameters.invert });
	});
}
