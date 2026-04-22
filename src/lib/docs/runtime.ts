import type { Component } from 'svelte';

type DocModule = {
	default: Component<any>;
};

const docModules = import.meta.glob('/docs/**/*.md', { eager: true }) as Record<string, DocModule>;

export function loadDocModule(importPath: string) {
	const module = docModules[importPath];

	if (!module) {
		return Promise.reject(new Error(`Unable to load the requested document: ${importPath}`));
	}

	return Promise.resolve(module);
}