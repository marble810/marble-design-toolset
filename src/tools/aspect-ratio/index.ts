import metadata from './metadata.json';
import type { ToolDefinition } from '$lib/types/tool';

const definition = {
	metadata,
	loadComponent: () => import('./AspectRatio.svelte')
} satisfies ToolDefinition;

export default definition;