import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { validateToolDirectory, validateToolsRoot } from './validate.mjs';

const workspaceRoot = path.resolve(import.meta.dirname, '..', '..');

test('current repo tools satisfy the contract validator', async () => {
	const errors = await validateToolsRoot(path.join(workspaceRoot, 'src', 'tools'));
	assert.deepEqual(errors, []);
});

test('validator reports multiple root-level Svelte files', async () => {
	const toolDir = await createValidToolFixture('bad-root-svelte');
	await writeFile(path.join(toolDir, 'Extra.svelte'), '<div></div>\n');

	const errors = await validateToolDirectory(toolDir, 'bad-root-svelte');

	assert.ok(errors.some((error) => error.message.includes('exactly one root-level .svelte')));
});

test('validator reports missing metadata fields', async () => {
	const toolDir = await createValidToolFixture('bad-metadata');
	await writeFile(
		path.join(toolDir, 'metadata.json'),
		JSON.stringify({ name: 'Bad Metadata', tag: [] }, null, 2)
	);

	const errors = await validateToolDirectory(toolDir, 'bad-metadata');

	assert.ok(errors.some((error) => error.message.includes('missing required field: desc')));
	assert.ok(errors.some((error) => error.message.includes('missing required field: version')));
});

test('validator reports unsupported tech stack declarations', async () => {
	const toolDir = await createValidToolFixture('bad-tech-stack');
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

async function createValidToolFixture(toolId) {
	const root = await mkdtemp(path.join(tmpdir(), 'mdt-tool-contract-'));
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
import type { ToolDefinition } from '$lib/types/tool';

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