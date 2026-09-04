/**
 * tool-builder public surface: the on-disk Tool Project build pipeline plus the
 * Catalog store. The evaluated-definition step (evaluateToolDefinition) is an internal
 * module of this package, not a public entry point.
 */
export {
	buildToolProject,
	DEFAULT_EXTRACTION_TIMEOUT_MS,
	DEFAULT_TOOL_BUILDER_ENVIRONMENT,
	isFrameworkLibraryImport
} from './pipeline.ts';
export type {
	BuildToolProjectInput,
	BuildToolProjectOutcome,
	ForgeProfileResources,
	ToolBuilderEnvironment
} from './pipeline.ts';

export { CatalogStore } from './catalog-store.ts';