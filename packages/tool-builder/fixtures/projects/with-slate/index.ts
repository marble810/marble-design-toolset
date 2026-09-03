import { defineInspectorCallback, defineVisualTool } from '@deshelf/tool-sdk';

export default defineVisualTool({
	parameters: {
		flowX: {
			type: 'number',
			label: 'Flow X',
			default: 0,
			mode: 'manual',
			constraint: { type: 'number', min: -1, max: 1, step: 0.01 }
		}
	},
	privateCallbacks: {
		resimulate: defineInspectorCallback({
			run() {
				return true;
			}
		})
	},
	createInspector({ root, parameters, privateCallbacks }) {
		root.slider({ id: 'flowX', label: 'Flow X', bind: parameters.flowX });
		root.button({ id: 'resimulate', label: 'Resimulate', bind: privateCallbacks.resimulate });
	},
	canvas: () => import('./canvas/Canvas.svelte'),
	slate: () => import('./slate/Slate.svelte'),
	dispose() {}
});