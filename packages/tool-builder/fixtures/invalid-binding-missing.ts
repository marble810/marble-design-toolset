/**
 * Fixture: createInspector binds a private callback handle that does not exist in the
 * privateCallbacks map (resolves to undefined) -> must fail extraction.
 */
import { defineVisualTool, defineInspectorCallback } from 'tool-sdk';

export default defineVisualTool({
	privateCallbacks: {
		resimulate: defineInspectorCallback({ run() {} })
	},
	createInspector({ root, privateCallbacks }) {
		// @ts-expect-error deliberate invalid binding: nonexistent map key
		root.button({ id: 'broken', label: 'Broken', bind: privateCallbacks.doesNotExist });
	},
	canvas: () => import('./canvas/Canvas.svelte')
});
