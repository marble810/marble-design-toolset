import type { ToolCatalogItem, ToolDefinition, ToolMetadata } from '$lib/types/tool';

type MetadataModule = ToolMetadata | { default: ToolMetadata };
type DefinitionModule = { default: ToolDefinition };

const metadataModules = import.meta.glob('/src/tools/*/metadata.json', { eager: true }) as Record<
	string,
	MetadataModule
>;

const definitionModules = import.meta.glob('/src/tools/*/index.ts') as Record<
	string,
	() => Promise<DefinitionModule>
>;

function unwrapMetadata(module: MetadataModule): ToolMetadata {
	return 'default' in module ? module.default : module;
}

function pathToToolId(path: string): string {
	return path.replace('/src/tools/', '').replace('/metadata.json', '').replace('/index.ts', '');
}

const catalog = Object.entries(metadataModules)
	.map(([path, module]) => ({
		id: pathToToolId(path),
		...unwrapMetadata(module)
	}))
	.sort((left, right) => left.name.localeCompare(right.name));

const catalogIds = new Set(catalog.map((item) => item.id));

export function getToolCatalog(): ToolCatalogItem[] {
	return catalog;
}

export function getToolCatalogItem(toolId: string): ToolCatalogItem | undefined {
	return catalog.find((item) => item.id === toolId);
}

export function isValidToolId(toolId: string | null | undefined): toolId is string {
	return Boolean(toolId && catalogIds.has(toolId));
}

export async function loadToolDefinition(toolId: string): Promise<ToolDefinition> {
	const definitionPath = `/src/tools/${toolId}/index.ts`;
	const loader = definitionModules[definitionPath];

	if (!loader) {
		throw new Error(`Unknown tool definition: ${toolId}`);
	}

	const module = await loader();
	return module.default;
}