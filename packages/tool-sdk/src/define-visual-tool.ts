/**
 * defineVisualTool: the single Tool Entry registration point. Returns the definition
 * unchanged (top-level has no side effects and performs no registration).
 */
import type {
	AssetKind,
	OutputKind,
	ParameterConstraint,
	ParameterMode,
	ParameterType
} from 'tool-contract';
import type { InspectorCallback } from './define-inspector-callback.ts';
import type { InspectorContext } from './context.ts';

export type ParameterValue = number | boolean | string;

export type ComputeFn = (deps: Readonly<Record<string, ParameterValue>>) => ParameterValue;

export interface ParameterDefinition {
	type: ParameterType;
	label: string;
	default: number | boolean | string;
	mode?: ParameterMode;
	constraint: ParameterConstraint;
	dependsOn?: readonly string[];
	/**
	 * Main-only compute implementation for `mode: 'computed'` parameters. Runs in the
	 * Main Container under Host scheduling; never serialized into the Catalog, which
	 * keeps only dependsOn + mode. Forge rejects computed parameters without compute.
	 */
	compute?: ComputeFn;
}

export interface AssetSlotDefinition {
	kind: AssetKind;
	label: string;
	accept?: readonly string[];
	required?: boolean;
}

export interface CommandExecutionContext {
	/** Aborted when the Host sends command.cancel; callbacks decide how to stop safely. */
	readonly signal: AbortSignal;
}

export interface CommandDefinition {
	label: string;
	run: (context: CommandExecutionContext) => unknown;
}

export interface VisualOutputDefinition {
	kind: OutputKind;
	label: string;
	mime: string;
	width?: number;
	height?: number;
	/** Main-only render/encode callback; never serialized into the Catalog. */
	render: (...args: never[]) => unknown;
}

export interface VisualToolDefinition {
	parameters?: Readonly<Record<string, ParameterDefinition>>;
	assets?: Readonly<Record<string, AssetSlotDefinition>>;
	commands?: Readonly<Record<string, CommandDefinition>>;
	privateCallbacks: Readonly<Record<string, InspectorCallback>>;
	outputs?: Readonly<Record<string, VisualOutputDefinition>>;
	createInspector?(ctx: InspectorContext): void;
	canvas: () => Promise<unknown>;
	slate?: () => Promise<unknown>;
	dispose?: () => void;
}

export function defineVisualTool<D extends VisualToolDefinition>(definition: D): D {
	if (
		definition === null ||
		typeof definition !== 'object' ||
		typeof definition.privateCallbacks !== 'object' ||
		definition.privateCallbacks === null ||
		(definition.createInspector !== undefined && typeof definition.createInspector !== 'function') ||
		typeof definition.canvas !== 'function'
	) {
		throw new TypeError(
			'defineVisualTool requires privateCallbacks and canvas; createInspector must be a function when provided'
		);
	}
	return definition;
}
