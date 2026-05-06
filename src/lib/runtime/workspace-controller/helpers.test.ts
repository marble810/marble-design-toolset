import assert from 'node:assert/strict';
import test from 'node:test';

import { deriveWorkspaceTabs } from './helpers.ts';
import type { ToolCatalogItem } from '$lib/types/tool';

const catalog: ToolCatalogItem[] = [
	{ id: 'aspect-ratio', name: 'Aspect Ratio', desc: 'Aspect.', tag: ['layout'], version: '1.0.0' },
	{
		id: 'noise-texture-creater',
		name: 'Noise Texture Creater',
		desc: 'Noise.',
		tag: ['texture'],
		version: '1.0.0'
	}
];

test('deriveWorkspaceTabs preserves open tool order and drops unknown ids', () => {
	assert.deepEqual(
		deriveWorkspaceTabs(['noise-texture-creater', 'missing', 'aspect-ratio'], catalog),
		[
			{ id: 'noise-texture-creater', label: 'Noise Texture Creater', closable: true },
			{ id: 'aspect-ratio', label: 'Aspect Ratio', closable: true }
		]
	);
});