/**
 * Fixture: a private callback map key is not a valid stable ID -> must fail extraction.
 */
import { defineVisualTool, defineInspectorCallback } from 'tool-sdk';

export default defineVisualTool({
	privateCallbacks: {
		// @ts-expect-error deliberate invalid stable ID (space, uppercase)
		'Bad Callback': defineInspectorCallback({ run() {} })
	},
	createInspector({ root }) {
		root.label('note', 'unreachable');
	},
	canvas: () => import('./canvas/Canvas.svelte')
});
