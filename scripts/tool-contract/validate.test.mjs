import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { validateToolDirectory, validateToolsRoot } from './validate.mjs';

const workspaceRoot = path.resolve(import.meta.dirname, '..', '..');
const scratchRoot = path.join(workspaceRoot, '.test-artifacts', 'tool-contract');

test('current repo tools satisfy the contract validator', async () => {
	const errors = await validateToolsRoot(path.join(workspaceRoot, 'src', 'tools'));
	assert.deepEqual(errors, []);
});

test('validator reports multiple root-level Svelte files', async (testContext) => {
	const toolDir = await createValidToolFixture('bad-root-svelte', testContext);
	await writeFile(path.join(toolDir, 'Extra.svelte'), '<div></div>\n');

	const errors = await validateToolDirectory(toolDir, 'bad-root-svelte');

	assert.ok(errors.some((error) => error.message.includes('exactly one root-level .svelte')));
});

test('validator reports missing metadata fields', async (testContext) => {
	const toolDir = await createValidToolFixture('bad-metadata', testContext);
	await writeFile(
		path.join(toolDir, 'metadata.json'),
		JSON.stringify({ name: 'Bad Metadata', tag: [] }, null, 2)
	);

	const errors = await validateToolDirectory(toolDir, 'bad-metadata');

	assert.ok(errors.some((error) => error.message.includes('missing required field: desc')));
	assert.ok(errors.some((error) => error.message.includes('missing required field: version')));
});

test('validator accepts declared export capabilities', async (testContext) => {
	const toolDir = await createValidToolFixture('export-tool', testContext);
	await writeFile(
		path.join(toolDir, 'metadata.json'),
		JSON.stringify(
			{
				name: 'Export Tool',
				desc: 'Fixture tool with export.',
				tag: ['fixture'],
				version: '1.0.0',
				enabled: true,
				export: { image: true, video: false }
			},
			null,
			2
		)
	);

	assert.deepEqual(await validateToolDirectory(toolDir, 'export-tool'), []);
});

test('validator reports invalid export capabilities', async (testContext) => {
	const toolDir = await createValidToolFixture('bad-export', testContext);
	await writeFile(
		path.join(toolDir, 'metadata.json'),
		JSON.stringify(
			{
				name: 'Bad Export',
				desc: 'Fixture tool with invalid export.',
				tag: ['fixture'],
				version: '1.0.0',
				export: { image: 'yes', pdf: true }
			},
			null,
			2
		)
	);

	const errors = await validateToolDirectory(toolDir, 'bad-export');

	assert.ok(errors.some((error) => error.message.includes('metadata.export.image must be a boolean')));
	assert.ok(errors.some((error) => error.message.includes('metadata.export contains unsupported field: pdf')));
});

test('validator reports unsupported tech stack declarations', async (testContext) => {
	const toolDir = await createValidToolFixture('bad-tech-stack', testContext);
	await writeFile(
		path.join(toolDir, 'index.ts'),
		`import metadata from './metadata.json';
import type { ToolDefinition } from '$lib/types/tool';

const definition = {
	metadata,
	techStack: ['pixi', 'matter'],
	loadComponent: () => import('./BadTechStack.svelte')
} satisfies ToolDefinition;

export default definition;
`
	);

	const errors = await validateToolDirectory(toolDir, 'bad-tech-stack');

	assert.ok(errors.some((error) => error.message.includes('unsupported tech stack: matter')));
});

test('validator allows public SDK and legacy compatibility imports', async (testContext) => {
	const toolDir = await createValidToolFixture('public-sdk-tool', testContext);
	await writeFile(
		path.join(toolDir, 'PublicSdkTool.svelte'),
		`<script lang="ts">
	import { createToolSourceInput, createRenderHostLifecycle } from '$lib/tool-sdk/index.js';
	import { createToolSourceInput as createLegacySourceInput } from '$lib/runtime/io/index.js';
	import { createRenderHostLifecycle as createLegacyRenderHost } from '$lib/runtime/render-host/index.js';

	const source = createToolSourceInput();
	const legacySource = createLegacySourceInput();
	const renderHost = createRenderHostLifecycle();
	const legacyRenderHost = createLegacyRenderHost();
</script>

<div>{source.accept}{legacySource.accept}{renderHost.isReady}{legacyRenderHost.isReady}</div>
`
	);

	const errors = await validateToolDirectory(toolDir, 'public-sdk-tool');

	assert.deepEqual(errors, []);
});

test('validator reports imports from framework internals', async (testContext) => {
	const toolDir = await createValidToolFixture('internal-import-tool', testContext);
	await writeFile(
		path.join(toolDir, 'InternalImportTool.svelte'),
		`<script lang="ts">
	import { createWorkspaceController } from '$lib/runtime/workspace-controller/index.js';

	const controller = createWorkspaceController([]);
</script>

<div>{controller.activeToolId}</div>
`
	);

	const errors = await validateToolDirectory(toolDir, 'internal-import-tool');

	assert.ok(
		errors.some(
			(error) =>
				error.message.includes('host boundary violation') &&
				error.message.includes('$lib/runtime/workspace-controller/index.js') &&
				error.message.includes('InternalImportTool.svelte:2')
		)
	);
});

async function createValidToolFixture(toolId, testContext) {
	await mkdir(scratchRoot, { recursive: true });
	const root = await mkdtemp(path.join(scratchRoot, 'fixture-'));
	testContext?.after(() => rm(root, { recursive: true, force: true }));
	const toolDir = path.join(root, toolId);
	const componentName = toolId
		.split('-')
		.map((token) => `${token[0].toUpperCase()}${token.slice(1)}`)
		.join('');

	await mkdir(path.join(toolDir, 'components'), { recursive: true });
	await writeFile(
		path.join(toolDir, 'metadata.json'),
		JSON.stringify(
			{
				name: componentName,
				desc: 'Fixture tool.',
				tag: ['fixture'],
				version: '1.0.0',
				enabled: true
			},
			 null,
			2
		)
	);
	await writeFile(
		path.join(toolDir, 'index.ts'),
		`import metadata from './metadata.json';
import type { ToolDefinition } from '$lib/tool-sdk/index.js';

const definition = {
	metadata,
	loadComponent: () => import('./${componentName}.svelte')
} satisfies ToolDefinition;

export default definition;
`
	);
	await writeFile(path.join(toolDir, `${componentName}.svelte`), '<div></div>\n');
	await writeFile(path.join(toolDir, 'components', `${componentName}Child.svelte`), '<div></div>\n');

	return toolDir;
}