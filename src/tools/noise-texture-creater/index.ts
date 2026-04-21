import metadata from './metadata.json';
import type { ToolDefinition } from '$lib/types/tool';

const definition = {
	metadata,
	techStack: ['pixi'],
	loadComponent: () => import('./NoiseTextureCreater.svelte')
} satisfies ToolDefinition;

export default definition;
