import { getDocsCatalog } from '$lib/docs/metadata';

export function load() {
	const catalog = getDocsCatalog();
	const firstDoc = catalog.entries[0] ?? null;

	return {
		docsTree: catalog.tree,
		docCount: catalog.entries.length,
		firstDoc,
		hasDocs: catalog.entries.length > 0
	};
}