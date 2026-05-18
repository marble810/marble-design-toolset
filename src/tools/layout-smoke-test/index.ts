import metadata from './metadata.json';
import type { ToolDefinition } from '$lib/tool-sdk/index.js';

const definition = {
metadata,
	loadComponent: () => import('./LayoutSmokeTest.svelte')
} satisfies ToolDefinition;

export default definition;
