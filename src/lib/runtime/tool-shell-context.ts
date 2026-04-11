import { getContext, setContext } from 'svelte';
import type { ToolMenuAction, ToolMetadata } from '$lib/types/tool';

export interface ToolShellContextValue {
	metadata: ToolMetadata;
	menuActions: ToolMenuAction[];
	openAbout: () => void;
	onMenuAction: (actionId: string) => void;
}

const TOOL_SHELL_CONTEXT = Symbol('tool-shell-context');

export function setToolShellContext(context: ToolShellContextValue): ToolShellContextValue {
	setContext(TOOL_SHELL_CONTEXT, context);
	return context;
}

export function getToolShellContext(): ToolShellContextValue {
	return getContext<ToolShellContextValue>(TOOL_SHELL_CONTEXT);
}