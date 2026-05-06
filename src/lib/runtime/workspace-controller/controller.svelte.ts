import { getToolCatalog, isValidToolId } from '$lib/runtime/tool-registry';
import {
	activateWorkspaceToolSelection,
	closeWorkspaceToolSelection,
	DEFAULT_LEFT_PANEL_WIDTH_VW,
	clampLeftPanelWidthVw,
	persistWorkspaceState,
	readHashToolId,
	resolveInitialWorkspaceState,
	writeHashToolId
} from '$lib/runtime/workspace-state';
import type { ToolCatalogItem } from '$lib/types/tool';
import { deriveWorkspaceTabs, type WorkspaceTabItem } from './helpers.js';

export interface WorkspaceControllerOptions {
	browser: boolean;
}

export interface WorkspaceController {
	readonly toolCatalog: ToolCatalogItem[];
	readonly openToolIds: string[];
	readonly activeToolId: string;
	readonly leftPanelWidthVw: number;
	readonly openTabs: WorkspaceTabItem[];
	activateTool: (toolId: string) => void;
	openTool: (toolId: string) => void;
	closeTool: (toolId: string) => void;
	setLeftPanelWidth: (value: number) => void;
}

export function createWorkspaceController(options: WorkspaceControllerOptions): WorkspaceController {
	const toolCatalog = getToolCatalog();
	const validToolIds = toolCatalog.map((tool) => tool.id);
	let openToolIds = $state<string[]>([]);
	let activeToolId = $state('');
	let leftPanelWidthVw = $state(DEFAULT_LEFT_PANEL_WIDTH_VW);
	let isHydrated = $state(false);

	const openTabs = $derived(deriveWorkspaceTabs(openToolIds, toolCatalog));

	function activateTool(toolId: string): void {
		if (!isValidToolId(toolId)) {
			return;
		}

		const nextSelection = activateWorkspaceToolSelection(
			{ openToolIds, activeToolId: activeToolId || null },
			toolId
		);
		openToolIds = nextSelection.openToolIds;
		activeToolId = nextSelection.activeToolId ?? '';
	}

	function closeTool(toolId: string): void {
		const nextSelection = closeWorkspaceToolSelection(
			{ openToolIds, activeToolId: activeToolId || null },
			toolId
		);
		openToolIds = nextSelection.openToolIds;
		activeToolId = nextSelection.activeToolId ?? '';
	}

	function setLeftPanelWidth(value: number): void {
		leftPanelWidthVw = clampLeftPanelWidthVw(value);
	}

	$effect(() => {
		if (!options.browser || isHydrated) {
			return;
		}

		const initialState = resolveInitialWorkspaceState(validToolIds);
		openToolIds = initialState.openToolIds;
		activeToolId = initialState.activeToolId ?? '';
		leftPanelWidthVw = initialState.leftPanelWidthVw;
		isHydrated = true;
	});

	$effect(() => {
		if (!options.browser || !isHydrated) {
			return;
		}

		persistWorkspaceState({
			openToolIds,
			activeToolId: activeToolId || null,
			leftPanelWidthVw
		});
		writeHashToolId(activeToolId || null);
	});

	$effect(() => {
		if (!options.browser || !isHydrated) {
			return;
		}

		const handleHashChange = () => {
			const hashToolId = readHashToolId();
			if (hashToolId && isValidToolId(hashToolId)) {
				activateTool(hashToolId);
			}
		};

		window.addEventListener('hashchange', handleHashChange);
		return () => window.removeEventListener('hashchange', handleHashChange);
	});

	return {
		get toolCatalog() {
			return toolCatalog;
		},
		get openToolIds() {
			return openToolIds;
		},
		get activeToolId() {
			return activeToolId;
		},
		get leftPanelWidthVw() {
			return leftPanelWidthVw;
		},
		get openTabs() {
			return openTabs;
		},
		activateTool,
		openTool: activateTool,
		closeTool,
		setLeftPanelWidth
	};
}