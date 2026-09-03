/**
 * Hello Canvas — the Deshelf Web adapter verification Tool Project.
 *
 * The only registration points are this file (the fixed Tool Entry) and the root
 * manifest.json. Parameters drive a rAF-driven Canvas 2D animation that lives entirely
 * inside the Tool Container; nothing here crosses the Environment API except the
 * management plane (parameter changes, one command, one export).
 */
import { defineInspectorCallback, defineVisualTool } from '@deshelf/tool-sdk';
import { resetPhase } from './sim/phase.ts';

export default defineVisualTool({
	parameters: {
		hue: {
			type: 'number',
			label: 'Hue',
			default: 210,
			mode: 'manual',
			constraint: { type: 'number', min: 0, max: 360, step: 1 }
		},
		speed: {
			type: 'number',
			label: 'Pulse Speed',
			default: 1,
			mode: 'manual',
			constraint: { type: 'number', min: 0.1, max: 3, step: 0.1 }
		},
		glow: {
			type: 'number',
			label: 'Glow',
			default: 0.5,
			mode: 'computed',
			constraint: { type: 'number', min: 0, max: 1, step: 0.01 },
			dependsOn: ['hue', 'speed'],
			compute: (deps) => {
				// Short, pure, no GPU/IO — Host schedules the wave, Main runs it.
				const hue = Number(deps.hue ?? 0);
				const speed = Number(deps.speed ?? 1);
				return Math.min(1, Math.max(0, ((hue / 360) * speed) / 3 + 0.15));
			}
		}
	},
	commands: {
		resetView: {
			label: 'Reset Phase',
			run() {
				resetPhase();
				return 'reset';
			}
		}
	},
	privateCallbacks: {
		ping: defineInspectorCallback({
			run() {
				return 'pong';
			}
		})
	},
	outputs: {
		frame: {
			kind: 'image',
			label: 'Frame PNG',
			mime: 'image/png',
			async render() {
				// Runs in the Main Container: the animation canvas lives in this document.
				const canvas = document.querySelector('canvas');
				if (canvas === null) throw new Error('canvas is not mounted');
				const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
				if (blob === null) throw new Error('canvas.toBlob returned null');
				return blob;
			}
		}
	},
	createInspector({ root, parameters, commands, privateCallbacks }) {
		root.section('appearance', 'Appearance', (section) => {
			section.slider({ id: 'hue', label: 'Hue', bind: parameters.hue });
			section.slider({ id: 'speed', label: 'Pulse Speed', bind: parameters.speed });
			section.slider({ id: 'glow', label: 'Glow (computed)', bind: parameters.glow });
		});
		root.button({ id: 'resetView', label: 'Reset Phase', bind: commands.resetView });
		root.button({ id: 'ping', label: 'Ping', bind: privateCallbacks.ping });
	},
	canvas: () => import('./canvas/Canvas.svelte'),
	slate: () => import('./slate/Slate.svelte'),
	dispose() {
		resetPhase();
	}
});
