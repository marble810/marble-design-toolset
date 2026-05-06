import { getContext, setContext } from 'svelte';
import type {
	ToolDefinition,
	ToolMenuAction,
	ToolMenuActionContext,
	ToolMetadata
} from '$lib/types/tool';
import type { TechStackKey, TechStackModule, TechStackModuleMap } from '$lib/types/tech-stack';

export interface ToolRuntimeContextValue {
	toolId: string;
	metadata: ToolMetadata;
	isActive: () => boolean;
	menuActions: readonly ToolMenuAction[];
	declaredTechStacks: readonly TechStackKey[];
	loadedTechStacks: Readonly<Partial<TechStackModuleMap>>;
	getLoadedTechStack: <Key extends TechStackKey>(key: Key) => TechStackModule<Key> | undefined;
	dispatchMenuAction: (actionId: string) => void;
}

const TOOL_RUNTIME_CONTEXT = Symbol('tool-runtime-context');

export function setToolRuntimeContext(context: ToolRuntimeContextValue): ToolRuntimeContextValue {
	setContext(TOOL_RUNTIME_CONTEXT, context);
	return context;
}

export function getToolRuntimeContext(): ToolRuntimeContextValue | undefined {
	return getContext<ToolRuntimeContextValue | undefined>(TOOL_RUNTIME_CONTEXT);
}

export function createToolMenuActionContext(
	context: ToolRuntimeContextValue
): ToolMenuActionContext {
	return {
		toolId: context.toolId,
		metadata: context.metadata,
		isActive: context.isActive,
		declaredTechStacks: context.declaredTechStacks,
		loadedTechStacks: context.loadedTechStacks,
		getLoadedTechStack: context.getLoadedTechStack
	};
}

export function dispatchToolMenuAction(
	definition: ToolDefinition | null | undefined,
	context: ToolRuntimeContextValue,
	actionId: string
): void {
	definition?.onMenuAction?.(actionId, createToolMenuActionContext(context));
}