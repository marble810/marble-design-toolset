import { getContext, setContext } from 'svelte';

export interface ToolSessionContextValue {
	isActive: () => boolean;
}

const TOOL_SESSION_CONTEXT = Symbol('tool-session-context');

export function setToolSessionContext(context: ToolSessionContextValue): ToolSessionContextValue {
	setContext(TOOL_SESSION_CONTEXT, context);
	return context;
}

export function getToolSessionContext(): ToolSessionContextValue | undefined {
	return getContext<ToolSessionContextValue | undefined>(TOOL_SESSION_CONTEXT);
}