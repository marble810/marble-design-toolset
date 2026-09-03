/**
 * Builds the descriptor-only Inspector context handed to `createInspector` during Forge
 * extraction. Every map key becomes a typed handle whose stable ID equals the key.
 */
import type { InspectorElement } from 'tool-contract';
import {
	createRoot,
	type AssetHandle,
	type CommandHandle,
	type InspectorRoot,
	type ParameterHandle,
	type PrivateCallbackHandle
} from './inspector.ts';
import type { InspectorCallback } from './define-inspector-callback.ts';
import type { AssetSlotDefinition, CommandDefinition, ParameterDefinition } from './define-visual-tool.ts';

export interface InspectorContext {
	root: InspectorRoot;
	parameters: Readonly<Record<string, ParameterHandle>>;
	assets: Readonly<Record<string, AssetHandle>>;
	commands: Readonly<Record<string, CommandHandle>>;
	privateCallbacks: Readonly<Record<string, PrivateCallbackHandle>>;
}

/** Internal marker: the builder appends here; extraction reads it via collectInspectorElements. */
interface InspectorContextInternal extends InspectorContext {
	__deshelfElements: InspectorElement[];
}

export interface CreateInspectorContextInput {
	parameters?: Readonly<Record<string, ParameterDefinition>>;
	assets?: Readonly<Record<string, AssetSlotDefinition>>;
	commands?: Readonly<Record<string, CommandDefinition>>;
	privateCallbacks: Readonly<Record<string, InspectorCallback>>;
}

function mapKeys<T>(
	map: Readonly<Record<string, unknown>> | undefined,
	make: (key: string) => T
): Readonly<Record<string, T>> {
	const out: Record<string, T> = {};
	if (map !== undefined) {
		for (const key of Object.keys(map)) {
			out[key] = make(key);
		}
	}
	return out;
}

export function createInspectorContext(input: CreateInspectorContextInput): InspectorContext {
	const elements: InspectorElement[] = [];
	const root = createRoot(elements);

	const context: InspectorContextInternal = {
		root,
		parameters: mapKeys(input.parameters, (k) => ({ __deshelfParameterId: k })),
		assets: mapKeys(input.assets, (k) => ({
			__deshelfAssetId: k,
			label: (input.assets as Record<string, { label?: string }>)[k]?.label ?? k
		})),
		commands: mapKeys(input.commands, (k) => ({ __deshelfCommandId: k })),
		privateCallbacks: mapKeys(input.privateCallbacks, (k) => ({ __deshelfCallbackId: k })),
		__deshelfElements: elements
	};
	return context;
}

export function collectInspectorElements(ctx: InspectorContext): readonly InspectorElement[] {
	return (ctx as InspectorContextInternal).__deshelfElements;
}
