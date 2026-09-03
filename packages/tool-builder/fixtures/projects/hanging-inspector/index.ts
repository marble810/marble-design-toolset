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
		// Intentionally blocks the extraction worker; the pipeline must terminate it.
		// eslint-disable-next-line no-constant-condition
		for (;;) {
			// hang forever
		}
	},
	canvas: () => import('./canvas/Canvas.svelte'),
	dispose() {}
});