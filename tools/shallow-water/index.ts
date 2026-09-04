/**
 * Shallow Water — the first Catalog-driven Tool Project migration sample.
 *
 * The only registration points are this file (the fixed Tool Entry) and the root
 * manifest.json. Parameters/commands/privateCallbacks/outputs are inert declarations;
 * the Host owns the Parameter Store and renders the Standard Inspector from the
 * build-time-extracted tree, while this Tool owns the Canvas (rAF + Three/WebGL hot
 * path, which never crosses the Environment API).
 */
import { defineInspectorCallback, defineVisualTool } from '@deshelf/tool-sdk';
import { buildInspector } from './inspector.ts';
import { PARAMETER_DEFINITIONS } from './parameters.ts';
import { OUTPUT_DEFINITIONS } from './outputs.ts';
import { bindSessionRuntime, getActiveSessionRuntime } from './sim/session.ts';

export default defineVisualTool({
	parameters: PARAMETER_DEFINITIONS,
	assets: {
		initMap: {
			kind: 'image',
			label: 'Init Map',
			accept: ['image/*'],
			required: false
		}
	},
	commands: {
		resetSimulation: {
			label: 'Reset Simulation',
			run() {
				// Re-seeds from the current init-map source (same action as the Inspector
				// button, invocable from the Host command API).
				getActiveSessionRuntime()?.resimulate();
			}
		}
	},
	privateCallbacks: {
		resimulate: defineInspectorCallback({
			run() {
				getActiveSessionRuntime()?.resimulate();
			}
		})
	},
	outputs: OUTPUT_DEFINITIONS,
	createInspector: buildInspector,
	canvas: () => import('./canvas/Canvas.svelte'),
	dispose() {
		// The Canvas unmount already released its runtime; clear the realm binding so a
		// disposed Session can never reach stale simulation state.
		bindSessionRuntime(null);
	}
});
