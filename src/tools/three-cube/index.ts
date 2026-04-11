import metadata from './metadata.json';
import type { ToolDefinition } from '$lib/types/tool';

const definition = {
	metadata,
	techStack: ['three'],
	loadComponent: () => import('./ThreeCube.svelte')
} satisfies ToolDefinition;

export default definition;