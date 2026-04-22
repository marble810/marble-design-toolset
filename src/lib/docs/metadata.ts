import { buildDocsCatalog, findDocBySlug, listDocRouteEntries } from './catalog';

const rawDocSources = import.meta.glob('/docs/**/*.md', {
	eager: true,
	query: '?raw',
	import: 'default'
}) as Record<string, string>;

const docsCatalog = buildDocsCatalog(Object.keys(rawDocSources), rawDocSources);

export function getDocsCatalog() {
	return docsCatalog;
}

export function getDocBySlugPath(slugPath: string | string[]) {
	return findDocBySlug(docsCatalog.entries, slugPath);
}

export function getDocRouteEntries() {
	return listDocRouteEntries(docsCatalog.entries);
}