/**
 * Fixture: a parameter ID collides with a private callback ID in the global stable-ID
 * namespace -> duplicate ID, must fail extraction.
 */
import { defineVisualTool, defineInspectorCallback } from 'tool-sdk';

export default defineVisualTool({
	parameters: {
		resimulate: {
			type: 'number',
			label: 'Resimulate (parameter)',
			default: 0,
			mode: 'manual',
			constraint: { type: 'number', min: 0, max: 1 }
		}
	},
	privateCallbacks: {
		resimulate: defineInspectorCallback({ run() {} })
	},
	createInspector({ root, parameters, privateCallbacks }) {
		root.slider({ id: 'resimulate', label: 'Resimulate', bind: parameters.resimulate });
		root.button({ id: 'resimulateBtn', label: 'Resimulate', bind: privateCallbacks.resimulate });
	},
	canvas: () => import('./canvas/Canvas.svelte')
});
