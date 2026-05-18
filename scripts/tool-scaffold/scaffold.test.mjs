import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import {
	CAPABILITY_RECIPES,
	buildScaffoldFiles,
	createToolScaffold,
	deriveToolNames,
	normalizeRecipeInput,
	parseTechStackInput
} from './index.js';
import { validateToolDirectory } from '../tool-contract/validate.mjs';

const workspaceRoot = path.resolve(import.meta.dirname, '..', '..');
const scratchRoot = path.join(workspaceRoot, '.test-artifacts', 'tool-scaffold');

async function createScratchWorkspace(testContext) {
	await mkdir(scratchRoot, { recursive: true });
	const workspace = await mkdtemp(path.join(scratchRoot, 'workspace-'));
	testContext.after(() => rm(workspace, { recursive: true, force: true }));
	return workspace;
}

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

test('normalizeRecipeInput accepts recipe numbers and aliases', () => {
	assert.equal(normalizeRecipeInput(''), 'preview-basic');
	assert.equal(normalizeRecipeInput('2'), 'source-preview');
	assert.equal(normalizeRecipeInput('pixi'), 'pixi-preview');
	assert.equal(normalizeRecipeInput('export'), 'preview-export');
	assert.equal(normalizeRecipeInput('layout'), 'layout-template');
	assert.equal(normalizeRecipeInput('6'), 'layout-template');
	assert.equal(normalizeRecipeInput('7'), 'custom');
	assert.throws(() => normalizeRecipeInput('unknown'), /Unknown capability recipe/);
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
	assert.match(files.get('index.ts'), /\$lib\/tool-sdk\/index\.js/);
	assert.doesNotMatch(files.get('metadata.json'), /techStack/);
	assert.match(files.get('BannerMaker.svelte'), /import \{ Field \}/);
	assert.ok(files.has(path.join('components', 'BannerMakerPreview.svelte')));
});

test('buildScaffoldFiles emits public-SDK recipe wiring', () => {
	const cases = [
		{
			recipeId: 'source-preview',
			componentName: 'RecipeToolSourcePreview',
			assertions: [
				/source-preview/,
				/createToolSourceInput/,
				/DropZone/,
				/SourceInputSection/,
				/\$lib\/tool-sdk\/index\.js/
			]
		},
		{
			recipeId: 'pixi-preview',
			componentName: 'RecipeToolPixiPreview',
			assertions: [/techStack: \['pixi'\]/, /createPixiApplicationHost/, /createRenderHostLifecycle/]
		},
		{
			recipeId: 'three-stage',
			componentName: 'RecipeToolThreeStage',
			assertions: [/techStack: \['three'\]/, /FullStage/, /createThreeRenderHost/]
		},
		{
			recipeId: 'preview-export',
			componentName: 'RecipeToolPreviewExport',
			assertions: [/"export": \{\n    "image": true\n  \}/, /registerCanvasExporter/, /createCanvas2DRenderHost/]
		},
		{
			recipeId: 'layout-template',
			componentName: 'RecipeToolLayoutTemplate',
			assertions: [
				/"export": \{\n    "image": true\n  \}/,
				/createLayoutToolController/,
				/SourceInputSection/,
				/slotId="hero"/,
				/allowedKinds: \['font'\]/,
				/Load Google Font/,
				/Open Google Fonts/,
				/Parse Google Fonts URL/,
				/loadGoogleFontFromUrl/
			]
		}
	];

	for (const { recipeId, componentName, assertions } of cases) {
		const files = buildScaffoldFiles({
			toolId: componentName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase(),
			displayName: componentName,
			componentName,
			recipeId
		});
		const generatedSource = [...files.values()].join('\n');

		for (const assertion of assertions) {
			assert.match(generatedSource, assertion, `${recipeId} should include ${assertion}`);
		}
		assert.doesNotMatch(generatedSource, /\$lib\/runtime\//, `${recipeId} should not import framework runtime internals`);
	}
});

test('all capability recipes generate contract-valid tool directories', async (testContext) => {
	const workspaceRoot = await createScratchWorkspace(testContext);
	await mkdir(path.join(workspaceRoot, 'src', 'tools'), { recursive: true });

	for (const recipe of CAPABILITY_RECIPES) {
		const names = deriveToolNames(`${recipe.id} sample`);
		const result = await createToolScaffold({
			workspaceRoot,
			...names,
			recipeId: recipe.id
		});
		const toolDir = path.join(workspaceRoot, 'src', 'tools', names.toolId);

		assert.equal(result.recipeId, recipe.id);
		assert.deepEqual(await validateToolDirectory(toolDir, names.toolId), []);
		assert.ok(
			result.createdFiles.includes(path.join('components', `${names.componentName}${recipe.componentSuffix}.svelte`))
		);
	}
});

test('createToolScaffold writes the generated tool into src/tools', async (testContext) => {
	const workspaceRoot = await createScratchWorkspace(testContext);
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
		/\$lib\/tool-sdk\/index\.js[\s\S]*createRenderHostLifecycle[\s\S]*Declared tech stacks: pixi/
	);
	assert.deepEqual(
		await validateToolDirectory(path.join(workspaceRoot, 'src', 'tools', 'banner-maker'), 'banner-maker'),
		[]
	);
});

test('createToolScaffold rejects collisions before writing new files', async (testContext) => {
	const workspaceRoot = await createScratchWorkspace(testContext);
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
