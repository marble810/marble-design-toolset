import type { Component } from 'svelte';

export type TechStackKey = 'three' | 'pixi' | 'gsap';

export interface ToolMetadata {
	name: string;
	desc: string;
	tag: string[];
	version: string;
}

export interface ToolMenuAction {
	id: string;
	label: string;
	disabled?: boolean;
}

export interface ToolDefinition {
	metadata: ToolMetadata;
	menuActions?: ToolMenuAction[];
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