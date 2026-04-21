/** @typedef {import('../types/tool').ToolCatalogItem} ToolCatalogItem */
/** @typedef {import('../types/tool').ToolMetadata} ToolMetadata */
/** @typedef {import('../types/tool').WorkspaceState} WorkspaceState */

/**
 * Treat missing metadata.enabled as enabled for backward compatibility.
 *
 * @param {ToolMetadata | ToolCatalogItem} metadata
 * @returns {boolean}
 */
export function isToolEnabled(metadata) {
	return metadata.enabled !== false;
}

/**
 * @template {ToolMetadata} T
 * @param {T[]} items
 * @returns {T[]}
 */
export function filterEnabledTools(items) {
	return items.filter((item) => isToolEnabled(item));
}

/**
 * @param {Partial<WorkspaceState> | null | undefined} input
 * @param {readonly string[]} validToolIds
 * @returns {{ openToolIds: string[]; activeToolId: string | null }}
 */
export function sanitizeWorkspaceToolSelection(input, validToolIds) {
	const validIds = new Set(validToolIds);
	const openToolIds = Array.isArray(input?.openToolIds)
		? input.openToolIds.filter((toolId) => typeof toolId === 'string' && validIds.has(toolId))
		: [];

	const activeToolId = typeof input?.activeToolId === 'string' && validIds.has(input.activeToolId)
		? input.activeToolId
		: openToolIds[0] ?? null;

	return {
		openToolIds,
		activeToolId
	};
}