export interface DocEntry {
	id: string;
	importPath: string;
	sourcePath: string;
	fileStem: string;
	title: string;
	groupSegments: string[];
	slugSegments: string[];
	slug: string;
	href: string;
}

export interface DocsTreeNode {
	id: string;
	label: string;
	segments: string[];
	groups: DocsTreeNode[];
	docs: DocEntry[];
}

export interface DocsTreeRoot {
	groups: DocsTreeNode[];
	docs: DocEntry[];
}

export interface DocsCatalog {
	entries: DocEntry[];
	tree: DocsTreeRoot;
}

const DOCS_DIRECTORY = 'docs/';
const MARKDOWN_EXTENSION = '.md';

function compareLabel(left: string, right: string) {
	return left.localeCompare(right, 'zh-CN', {
		numeric: true,
		sensitivity: 'base'
	});
}

function toImportPath(path: string) {
	const normalized = path.replace(/\\/g, '/');
	return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function toSourcePath(importPath: string) {
	return importPath.replace(/^\//, '');
}

function toDocsRelativePath(importPath: string) {
	const sourcePath = toSourcePath(importPath);
	const docsIndex = sourcePath.indexOf(DOCS_DIRECTORY);

	if (docsIndex === -1) {
		throw new Error(`Unsupported docs path: ${importPath}`);
	}

	return sourcePath.slice(docsIndex + DOCS_DIRECTORY.length);
}

function humanizeSegment(segment: string) {
	return segment
		.split(/[-_]+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

function extractDocTitle(markdownSource: string | undefined, fallbackStem: string) {
	const headingMatch = markdownSource?.match(/^#\s+(.+)$/m);
	return headingMatch?.[1]?.trim() || humanizeSegment(fallbackStem);
}

function createTreeNode(segments: string[]): DocsTreeNode {
	const lastSegment = segments.at(-1) ?? 'docs';

	return {
		id: segments.join('/'),
		label: humanizeSegment(lastSegment),
		segments,
		groups: [],
		docs: []
	};
}

function sortTree(root: DocsTreeRoot | DocsTreeNode) {
	root.docs.sort((left, right) => compareLabel(left.title, right.title));
	root.groups.sort((left, right) => compareLabel(left.label, right.label));

	for (const group of root.groups) {
		sortTree(group);
	}
	return root;
}

export function buildDocsCatalog(paths: string[], rawSources: Record<string, string> = {}): DocsCatalog {
	const entries = paths
		.map((path) => {
			const importPath = toImportPath(path);
			const relativePath = toDocsRelativePath(importPath);

			if (!relativePath.endsWith(MARKDOWN_EXTENSION)) {
				throw new Error(`Only Markdown documents are supported: ${importPath}`);
			}

			const segments = relativePath.split('/').filter(Boolean);
			const fileName = segments.at(-1);

			if (!fileName) {
				throw new Error(`Missing Markdown file name for: ${importPath}`);
			}

			const fileStem = fileName.slice(0, -MARKDOWN_EXTENSION.length);
			const groupSegments = segments.slice(0, -1);
			const slugSegments = [...groupSegments, fileStem];
			const slug = slugSegments.join('/');

			return {
				id: slug,
				importPath,
				sourcePath: toSourcePath(importPath),
				fileStem,
				title: extractDocTitle(rawSources[importPath], fileStem),
				groupSegments,
				slugSegments,
				slug,
				href: `/docs/${slug}`
			} satisfies DocEntry;
		})
		.sort((left, right) => compareLabel(left.sourcePath, right.sourcePath));

	const tree: DocsTreeRoot = {
		groups: [],
		docs: []
	};

	for (const entry of entries) {
		if (entry.groupSegments.length === 0) {
			tree.docs.push(entry);
			continue;
		}

		let currentLevel = tree;
		let currentSegments: string[] = [];

		for (const segment of entry.groupSegments) {
			currentSegments = [...currentSegments, segment];
			let group = currentLevel.groups.find((candidate) => candidate.id === currentSegments.join('/'));

			if (!group) {
				group = createTreeNode(currentSegments);
				currentLevel.groups.push(group);
			}

			currentLevel = group;
		}

		currentLevel.docs.push(entry);
	}

	return {
		entries,
		tree: sortTree(tree)
	};
}

function normalizeSlugPath(slugPath: string | string[]) {
	const joined = Array.isArray(slugPath) ? slugPath.join('/') : slugPath;
	return joined
		.split('/')
		.map((segment) => segment.trim())
		.filter(Boolean)
		.join('/');
}

export function findDocBySlug(entries: DocEntry[], slugPath: string | string[]) {
	const normalizedSlug = normalizeSlugPath(slugPath);
	return entries.find((entry) => entry.slug === normalizedSlug) ?? null;
}

export function listDocRouteEntries(entries: DocEntry[]) {
	return entries.map((entry) => ({ slug: entry.slug }));
}