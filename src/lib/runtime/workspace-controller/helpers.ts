import type { ToolCatalogItem } from '$lib/types/tool';

export interface WorkspaceTabItem {
	id: string;
	label: string;
	closable: boolean;
}

export function deriveWorkspaceTabs(
	openToolIds: readonly string[],
	toolCatalog: readonly ToolCatalogItem[]
): WorkspaceTabItem[] {
	return openToolIds.flatMap((toolId) => {
		const tool = toolCatalog.find((entry) => entry.id === toolId);
		return tool ? [{ id: tool.id, label: tool.name, closable: true }] : [];
	});
}