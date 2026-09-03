/**
 * Fixture: createInspector binds an inline anonymous callback instead of a typed handle
 * from the privateCallbacks map -> must fail extraction.
 */
import { defineVisualTool, defineInspectorCallback } from 'tool-sdk';

export default defineVisualTool({
	privateCallbacks: {
		resimulate: defineInspectorCallback({ run() {} })
	},
	createInspector({ root }) {
		// @ts-expect-error inline anonymous callbacks are forbidden by the SDK contract
		root.button({ id: 'anon', label: 'Anon', bind: () => {} });
	},
	canvas: () => import('./canvas/Canvas.svelte')
});
