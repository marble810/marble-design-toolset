import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDocsCatalog, findDocBySlug, listDocRouteEntries } from './catalog.ts';

test('buildDocsCatalog keeps directory groups and derives titles from headings', () => {
	const catalog = buildDocsCatalog(
		[
			'/docs/guides/tool-authoring-guide.md',
			'/docs/architecture/project-architecture-analysis.md',
			'/docs/guides/renderers/tool-pixi-guide.md'
		],
		{
			'/docs/guides/tool-authoring-guide.md': '# Tool Authoring Guide\n',
			'/docs/architecture/project-architecture-analysis.md': '# Project Architecture Analysis\n',
			'/docs/guides/renderers/tool-pixi-guide.md': '# Pixi Renderer Guide\n'
		}
	);

	assert.deepStrictEqual(catalog.entries.map((entry) => entry.slug), [
		'architecture/project-architecture-analysis',
		'guides/renderers/tool-pixi-guide',
		'guides/tool-authoring-guide'
	]);
	assert.deepStrictEqual(catalog.tree.groups.map((group) => group.id), ['architecture', 'guides']);
	assert.equal(catalog.tree.groups[1]?.groups[0]?.label, 'Renderers');
	assert.equal(catalog.tree.groups[1]?.docs[0]?.title, 'Tool Authoring Guide');
	assert.equal(catalog.tree.groups[1]?.groups[0]?.docs[0]?.title, 'Pixi Renderer Guide');
	assert.deepStrictEqual(listDocRouteEntries(catalog.entries), [
		{ slug: 'architecture/project-architecture-analysis' },
		{ slug: 'guides/renderers/tool-pixi-guide' },
		{ slug: 'guides/tool-authoring-guide' }
	]);
});

test('findDocBySlug returns null for missing documents', () => {
	const catalog = buildDocsCatalog(['/docs/guides/css-styling-guide.md']);

	assert.equal(findDocBySlug(catalog.entries, 'guides/missing-doc'), null);
	assert.equal(findDocBySlug(catalog.entries, ['guides', 'css-styling-guide'])?.title, 'Css Styling Guide');
});