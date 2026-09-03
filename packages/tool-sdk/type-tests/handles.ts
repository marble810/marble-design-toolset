/**
 * Compile-time contract tests for the Deshelf Tool SDK. These files are typechecked by
 * `bun run typecheck` (tsc --noEmit); they are never executed at runtime (not *.test.ts).
 *
 * They prove that typed Inspector handles reject forged/wrong bindings and that
 * callback/compute definitions enforce their intended signatures.
 */
import {
	defineInspectorCallback,
	defineVisualTool,
	type InspectorContext,
	type ParameterDefinition
} from '../src/index.ts';

// --- Positive: valid typed usage compiles -----------------------------------------

defineVisualTool({
	parameters: {
		amplitude: {
			type: 'number',
			label: 'A',
			default: 0.5,
			mode: 'manual',
			constraint: { type: 'number', min: 0, max: 1 }
		},
		density: {
			type: 'number',
			label: 'D',
			default: 1,
			mode: 'computed',
			dependsOn: ['amplitude'],
			constraint: { type: 'number', min: 0, max: 2 },
			compute: (deps) => Number(deps.amplitude) * 2
		}
	},
	commands: {
		resetView: {
			label: 'Reset',
			run() {
				return 1;
			}
		}
	},
	privateCallbacks: {
		resimulate: defineInspectorCallback({
			run(seed: number): string {
				return `seed:${seed}`;
			}
		})
	},
	outputs: {
		heightMap: {
			kind: 'image',
			label: 'H',
			mime: 'image/png',
			render() {
				return new Uint8Array(0);
			}
		}
	},
	createInspector({ root, parameters, commands, privateCallbacks }: InspectorContext) {
		root.slider({ id: 'amp', label: 'Amp', bind: parameters.amplitude });
		root.button({ id: 'resim', label: 'Resim', bind: privateCallbacks.resimulate });
		root.button({ id: 'reset', label: 'Reset', bind: commands.resetView });
	},
	canvas: async () => ({})
});

// createInspector is optional; Forge/Host derives a default tree from Parameter descriptors.
defineVisualTool({ privateCallbacks: {}, canvas: async () => ({}) });

declare const ctx: InspectorContext;

// --- Negative: forged or wrong typed handles are rejected at compile time ---------

// @ts-expect-error a forged callback handle with a non-string id is not a valid handle
ctx.root.button({ id: 'a', label: 'A', bind: { __deshelfCallbackId: 5 } });

// @ts-expect-error a parameter handle cannot bind a button
ctx.root.button({ id: 'b', label: 'B', bind: { __deshelfParameterId: 'amplitude' } });

// @ts-expect-error inline anonymous callbacks are not typed handles
ctx.root.button({ id: 'c', label: 'C', bind: () => {} });

// @ts-expect-error raw id strings are not typed handles
ctx.root.button({ id: 'd', label: 'D', bind: 'resimulate' });

// @ts-expect-error a forged command handle with a non-string id is invalid
ctx.root.button({ id: 'e', label: 'E', bind: { __deshelfCommandId: 42 } });

// @ts-expect-error a forged parameter handle with a non-string id cannot drive a slider
ctx.root.slider({ id: 'f', label: 'F', bind: { __deshelfParameterId: 123 } });

// @ts-expect-error a private callback handle cannot drive a slider (kind mismatch)
ctx.root.slider({ id: 'g', label: 'G', bind: { __deshelfCallbackId: 'resimulate' } });

// --- Negative: callback/compute definitions enforce their signatures --------------

// @ts-expect-error defineInspectorCallback requires a run function
defineInspectorCallback({});

// @ts-expect-error run must be a function, not a string
defineInspectorCallback({ run: 'nope' });

// @ts-expect-error Visual Outputs must retain a Main-only render implementation
const missingRenderOutput: import('../src/index.ts').VisualOutputDefinition = {
	kind: 'image',
	label: 'Missing Render',
	mime: 'image/png'
};

// compute signature negatives: the error is reported on the compute property line.
const badComputeParams: ParameterDefinition = {
	type: 'number',
	label: 'X',
	default: 1,
	mode: 'computed',
	dependsOn: ['a'],
	constraint: { type: 'number', min: 0, max: 1 },
	// @ts-expect-error compute must accept the typed deps record, not a bare number
	compute: (deps: number) => deps
};

const badComputeResult: ParameterDefinition = {
	type: 'number',
	label: 'Y',
	default: 1,
	mode: 'computed',
	dependsOn: ['a'],
	constraint: { type: 'number', min: 0, max: 1 },
	// @ts-expect-error compute must return a ParameterValue, not an object
	compute: () => ({ x: 1 })
};

export {};