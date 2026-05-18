import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDocsCatalog, findDocBySlug, listDocRouteEntries } from './catalog.ts';

test('buildDocsCatalog keeps directory groups and derives titles from headings', () => {
	const catalog = buildDocsCatalog(
		[
			'/docs/for-tool-developers/create-a-tool.md',
			'/docs/for-framework-developers/overview.md',
			'/docs/for-tool-developers/ui-controls/slider-field.md'
		],
		{
			'/docs/for-tool-developers/create-a-tool.md': '# Tool 开发入门\n',
			'/docs/for-framework-developers/overview.md': '# 框架开发者指南\n',
			'/docs/for-tool-developers/ui-controls/slider-field.md': '# SliderField 使用指南\n'
		}
	);

	assert.deepStrictEqual(catalog.entries.map((entry) => entry.slug), [
		'for-framework-developers/overview',
		'for-tool-developers/create-a-tool',
		'for-tool-developers/ui-controls/slider-field'
	]);
	assert.deepStrictEqual(catalog.tree.groups.map((group) => group.id), [
		'for-framework-developers',
		'for-tool-developers'
	]);
	assert.equal(catalog.tree.groups[1]?.groups[0]?.label, 'Ui Controls');
	assert.equal(catalog.tree.groups[0]?.docs[0]?.title, '框架开发者指南');
	assert.equal(catalog.tree.groups[1]?.docs[0]?.title, 'Tool 开发入门');
	assert.equal(catalog.tree.groups[1]?.groups[0]?.docs[0]?.title, 'SliderField 使用指南');
	assert.deepStrictEqual(listDocRouteEntries(catalog.entries), [
		{ slug: 'for-framework-developers/overview' },
		{ slug: 'for-tool-developers/create-a-tool' },
		{ slug: 'for-tool-developers/ui-controls/slider-field' }
	]);
});

test('findDocBySlug returns null for missing documents', () => {
	const catalog = buildDocsCatalog(['/docs/for-tool-developers/css-styling.md']);

	assert.equal(findDocBySlug(catalog.entries, 'for-tool-developers/missing-doc'), null);
	assert.equal(
		findDocBySlug(catalog.entries, ['for-tool-developers', 'css-styling'])?.title,
		'Css Styling'
	);
});