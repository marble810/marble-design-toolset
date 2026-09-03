import { defineInspectorCallback, defineVisualTool } from '@deshelf/tool-sdk';

export default defineVisualTool({
	parameters: {},
	privateCallbacks: {
		resimulate: defineInspectorCallback({
			run() {
				return true;
			}
		})
	},
	createInspector() {
		throw new Error('boom: inspector exploded');
	},
	canvas: () => import('./canvas/Canvas.svelte'),
	dispose() {}
});