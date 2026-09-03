/**
 * A valid deterministic fixture Tool Entry, shaped exactly like the MAB-65 sample:
 * root manifest.json + fixed index.ts + defineVisualTool default export.
 * The canvas import is dynamic and never executed during extraction.
 */
import { defineVisualTool, defineInspectorCallback } from 'tool-sdk';

export default defineVisualTool({
	parameters: {
		amplitude: {
			type: 'number',
			label: 'Amplitude',
			default: 0.5,
			mode: 'manual',
			constraint: { type: 'number', min: 0, max: 1, step: 0.01 }
		},
		damping: {
			type: 'number',
			label: 'Damping',
			default: 0.98,
			mode: 'manual',
			constraint: { type: 'number', min: 0, max: 1 }
		},
		invert: {
			type: 'boolean',
			label: 'Invert',
			default: false,
			mode: 'manual',
			constraint: { type: 'boolean' }
		},
		sourceMode: {
			type: 'select',
			label: 'Source Mode',
			default: 'preset',
			mode: 'manual',
			constraint: { type: 'select', options: ['preset', 'image'] }
		}
	},
	assets: {
		initMap: { kind: 'image', label: 'Init Map', accept: ['image/png', 'image/jpeg'], required: false }
	},
	commands: {
		resetView: { label: 'Reset View', run() {} }
	},
	privateCallbacks: {
		resimulate: defineInspectorCallback({ run() {} })
	},
	outputs: {
		heightMap: { kind: 'image', label: 'Height Map', mime: 'image/png', render() {} }
	},
	createInspector({ root, parameters, commands, privateCallbacks }) {
		root.section('source', 'Source', (r) => {
			r.select({ id: 'sourceMode', label: 'Source Mode', bind: parameters.sourceMode });
		});
		root.slider({ id: 'amplitude', label: 'Amplitude', bind: parameters.amplitude, step: 0.01 });
		root.slider({ id: 'damping', label: 'Damping', bind: parameters.damping });
		root.toggle({ id: 'invert', label: 'Invert', bind: parameters.invert });
		root.button({ id: 'resimulate', label: 'Resimulate', bind: privateCallbacks.resimulate });
		root.button({ id: 'resetView', label: 'Reset View', bind: commands.resetView });
	},
	canvas: () => import('./canvas/Canvas.svelte'),
	dispose() {}
});
