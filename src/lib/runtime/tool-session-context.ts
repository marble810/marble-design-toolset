import { getContext, setContext } from 'svelte';

export interface ToolSessionContextValue {
	readonly active: boolean;
	isActive: () => boolean;
	onActiveChange: (callback: (active: boolean) => void) => () => void;
}

const TOOL_SESSION_CONTEXT = Symbol('tool-session-context');

export function setToolSessionContext(context: ToolSessionContextValue): ToolSessionContextValue {
	setContext(TOOL_SESSION_CONTEXT, context);
	return context;
}

export function getToolSessionContext(): ToolSessionContextValue | undefined {
	return getContext<ToolSessionContextValue | undefined>(TOOL_SESSION_CONTEXT);
}