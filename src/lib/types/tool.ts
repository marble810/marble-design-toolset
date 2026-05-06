import type { Component } from 'svelte';
import type { TechStackKey, TechStackModule, TechStackModuleMap } from './tech-stack';

export type { TechStackKey } from './tech-stack';

/**
 * Declares which kinds of canvas exports a tool advertises in the framework
 * Export panel. Both flags default to `false`. Tools that declare an export
 * kind must also register a matching exporter via `getCanvasExportContext()`,
 * otherwise the panel renders the controls in a disabled state with a hint.
 */
export interface ToolExportCapabilities {
	image?: boolean;
	video?: boolean;
}

export interface ToolMetadata {
	name: string;
	desc: string;
	tag: string[];
	version: string;
	enabled?: boolean;
	export?: ToolExportCapabilities;
}

export interface ToolMenuAction {
	id: string;
	label: string;
	disabled?: boolean;
}

export interface ToolMenuActionContext {
	toolId: string;
	metadata: ToolMetadata;
	isActive: () => boolean;
	declaredTechStacks: readonly TechStackKey[];
	loadedTechStacks: Readonly<Partial<TechStackModuleMap>>;
	getLoadedTechStack: <Key extends TechStackKey>(key: Key) => TechStackModule<Key> | undefined;
}

export interface ToolDefinition {
	metadata: ToolMetadata;
	menuActions?: ToolMenuAction[];
	onMenuAction?: (actionId: string, context: ToolMenuActionContext) => void;
	techStack?: TechStackKey[];
	loadComponent: () => Promise<{ default: Component<any> }>;
}

export interface ToolCatalogItem extends ToolMetadata {
	id: string;
}

export interface WorkspaceState {
	openToolIds: string[];
	activeToolId: string | null;
	leftPanelWidthVw: number;
}