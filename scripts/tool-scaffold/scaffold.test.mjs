import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
	buildScaffoldFiles,
	createToolScaffold,
	deriveToolNames,
	parseTechStackInput
} from './index.js';
import { validateToolDirectory } from '../tool-contract/validate.mjs';

test('deriveToolNames normalizes a display name into tool id and component name', () => {
	assert.deepStrictEqual(deriveToolNames('Banner Maker 2'), {
		toolId: 'banner-maker-2',
		displayName: 'Banner Maker 2',
		componentName: 'BannerMaker2'
	});
});

test('parseTechStackInput validates and de-duplicates supported stacks', () => {
	assert.deepStrictEqual(parseTechStackInput('three, gsap, three'), ['three', 'gsap']);
	assert.throws(() => parseTechStackInput('three, unknown'), /Unsupported tech stack: unknown/);
});

test('buildScaffoldFiles emits tech stacks only in index.ts', () => {
	const files = buildScaffoldFiles({
		toolId: 'banner-maker',
		displayName: 'Banner Maker',
		componentName: 'BannerMaker',
		starterType: 'preview',
		techStacks: ['three', 'gsap'],
		description: 'Preview starter scaffold for the Banner Maker tool.',
		tags: ['starter', 'preview'],
		version: '1.0.0',
		enabled: true
	});

	assert.match(files.get('index.ts'), /techStack: \['three', 'gsap'\]/);
	assert.doesNotMatch(files.get('metadata.json'), /techStack/);
	assert.match(files.get('BannerMaker.svelte'), /import \{ Field \}/);
	assert.ok(files.has(path.join('components', 'BannerMakerPreview.svelte')));
});

test('createToolScaffold writes the generated tool into src/tools', async () => {
	const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'marble-tool-scaffold-'));
	await mkdir(path.join(workspaceRoot, 'src', 'tools'), { recursive: true });

	const result = await createToolScaffold({
		workspaceRoot,
		toolId: 'banner-maker',
		displayName: 'Banner Maker',
		componentName: 'BannerMaker',
		starterType: 'stage',
		techStacks: ['pixi'],
		description: 'Stage starter scaffold for the Banner Maker tool.',
		tags: ['starter', 'stage'],
		version: '1.0.0',
		enabled: true
	});

	assert.equal(result.toolId, 'banner-maker');
	assert.match(
		await readFile(path.join(workspaceRoot, 'src', 'tools', 'banner-maker', 'index.ts'), 'utf8'),
		/techStack: \['pixi'\]/
	);
	assert.match(
		await readFile(
			path.join(workspaceRoot, 'src', 'tools', 'banner-maker', 'components', 'BannerMakerStage.svelte'),
			'utf8'
		),
		/createRenderHostLifecycle[\s\S]*Declared tech stacks: pixi/
	);
	assert.deepEqual(
		await validateToolDirectory(path.join(workspaceRoot, 'src', 'tools', 'banner-maker'), 'banner-maker'),
		[]
	);
});

test('createToolScaffold rejects collisions before writing new files', async () => {
	const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'marble-tool-scaffold-'));
	const toolDir = path.join(workspaceRoot, 'src', 'tools', 'banner-maker');
	await mkdir(toolDir, { recursive: true });
	await writeFile(path.join(toolDir, 'metadata.json'), '{}', 'utf8');

	await assert.rejects(
		createToolScaffold({
			workspaceRoot,
			toolId: 'banner-maker',
			displayName: 'Banner Maker',
			componentName: 'BannerMaker',
			starterType: 'preview',
			techStacks: [],
			description: 'Preview starter scaffold for the Banner Maker tool.',
			tags: ['starter', 'preview'],
			version: '1.0.0',
			enabled: true
		}),
		/Tool directory already exists/
	);
});