import { defineInspectorCallback, defineVisualTool } from '@deshelf/tool-sdk';

export default defineVisualTool({
	parameters: {
		amplitude: {
			type: 'number',
			label: 'Amplitude',
			default: 0.5,
			mode: 'manual',
			constraint: { type: 'number', min: 0, max: 1, step: 0.01 }
		}
	},
	commands: {
		resetView: {
			label: 'Reset View',
			run() {
				return 'reset';
			}
		}
	},
	privateCallbacks: {
		resimulate: defineInspectorCallback({
			run() {
				return 'resimulated';
			}
		})
	},
	outputs: {
		heightMap: {
			kind: 'image',
			label: 'Height Map',
			mime: 'image/png',
			render() {
				return new Uint8Array(0);
			}
		}
	},
	createInspector({ root, parameters, commands, privateCallbacks }) {
		root.slider({ id: 'amplitude', label: 'Amplitude', bind: parameters.amplitude });
		root.button({ id: 'resimulate', label: 'Resimulate', bind: privateCallbacks.resimulate });
		root.button({ id: 'resetView', label: 'Reset View', bind: commands.resetView });
	},
	canvas: () => import('./canvas/Canvas.svelte'),
	dispose() {}
});