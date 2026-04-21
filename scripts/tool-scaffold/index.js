import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
	renderMetadata,
	renderPreviewComponent,
	renderPreviewMasterComponent,
	renderStageComponent,
	renderStageMasterComponent,
	renderToolDefinition
} from './templates/index.js';

export const STARTER_TYPES = ['preview', 'stage'];
export const SUPPORTED_TECH_STACKS = ['three', 'pixi', 'gsap'];

function capitalize(value) {
	return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

function tokenizeName(input) {
	return input
		.trim()
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/[^A-Za-z0-9]+/g, ' ')
		.split(/\s+/)
		.filter(Boolean)
		.map((token) => token.toLowerCase());
}

export function deriveToolNames(input) {
	const tokens = tokenizeName(input);

	if (!tokens.length) {
		throw new Error('Tool name must include at least one letter or number.');
	}

	const toolId = tokens.join('-');

	if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(toolId)) {
		throw new Error('Tool name must normalize to a kebab-case id that starts with a letter.');
	}

	return {
		toolId,
		displayName: tokens.map(capitalize).join(' '),
		componentName: tokens.map(capitalize).join('')
	};
}

export function normalizeStarterType(input) {
	const normalized = input.trim().toLowerCase();

	if (!normalized || normalized === '1' || normalized === 'preview' || normalized === 'p') {
		return 'preview';
	}

	if (normalized === '2' || normalized === 'stage' || normalized === 's') {
		return 'stage';
	}

	throw new Error(`Unknown starter type: ${input}`);
}

export function parseTechStackInput(input) {
	if (!input.trim()) {
		return [];
	}

	const values = input
		.split(',')
		.map((value) => value.trim().toLowerCase())
		.filter(Boolean);

	const deduped = [];

	for (const value of values) {
		if (!SUPPORTED_TECH_STACKS.includes(value)) {
			throw new Error(`Unsupported tech stack: ${value}`);
		}

		if (!deduped.includes(value)) {
			deduped.push(value);
		}
	}

	return deduped;
}

async function promptUntilValid({ rl, question, parse, fallback }) {
	while (true) {
		const answer = await rl.question(question);
		const value = answer.trim() || fallback;

		try {
			return parse(value ?? '');
		} catch (error) {
			console.error(error instanceof Error ? error.message : String(error));
		}
	}
	}

export async function collectScaffoldOptions({ rl, initialName }) {
	const toolIdentity = initialName
		? deriveToolNames(initialName)
		: await promptUntilValid({
				rl,
				question: 'Tool name: ',
				parse: deriveToolNames
			});

	const starterType = await promptUntilValid({
		rl,
		question: 'Starter type ([1] preview, [2] stage) [1]: ',
		parse: normalizeStarterType,
		fallback: 'preview'
	});

	const techStacks = await promptUntilValid({
		rl,
		question: `Tech stacks (comma-separated: ${SUPPORTED_TECH_STACKS.join(', ')}) [none]: `,
		parse: parseTechStackInput,
		fallback: ''
	});

	return {
		...toolIdentity,
		starterType,
		techStacks,
		description: `${capitalize(starterType)} starter scaffold for the ${toolIdentity.displayName} tool.`,
		tags: ['starter', starterType],
		version: '1.0.0',
		enabled: true
	};
}

async function assertToolDirectoryAvailable(toolDir) {
	try {
		await access(toolDir);
		throw new Error(`Tool directory already exists: ${toolDir}`);
	} catch (error) {
		if (error instanceof Error && error.message.startsWith('Tool directory already exists:')) {
			throw error;
		}
	}
}

export function buildScaffoldFiles({ toolId, displayName, componentName, starterType, techStacks, description, tags, version, enabled }) {
	const childComponentName = starterType === 'stage' ? `${componentName}Stage` : `${componentName}Preview`;
	const masterComponent =
		starterType === 'stage'
			? renderStageMasterComponent({ toolId, componentName, displayName, techStacks })
			: renderPreviewMasterComponent({ toolId, componentName, displayName, techStacks });
	const childComponent =
		starterType === 'stage'
			? renderStageComponent({ toolId, displayName, techStacks })
			: renderPreviewComponent({ toolId, displayName });

	return new Map([
		['metadata.json', renderMetadata({ displayName, description, starterType, version, enabled, tags })],
		['index.ts', renderToolDefinition({ componentName, techStacks })],
		[`${componentName}.svelte`, masterComponent],
		[path.join('components', `${childComponentName}.svelte`), childComponent]
	]);
}

export async function createToolScaffold({ workspaceRoot, ...options }) {
	if (!STARTER_TYPES.includes(options.starterType)) {
		throw new Error(`Unsupported starter type: ${options.starterType}`);
	}

	for (const techStack of options.techStacks) {
		if (!SUPPORTED_TECH_STACKS.includes(techStack)) {
			throw new Error(`Unsupported tech stack: ${techStack}`);
		}
	}

	const toolDir = path.join(workspaceRoot, 'src', 'tools', options.toolId);
	await assertToolDirectoryAvailable(toolDir);

	const files = buildScaffoldFiles(options);
	await mkdir(path.join(toolDir, 'components'), { recursive: true });

	for (const [relativePath, content] of files) {
		await writeFile(path.join(toolDir, relativePath), content, 'utf8');
	}

	return {
		toolDir,
		createdFiles: [...files.keys()],
		toolId: options.toolId,
		displayName: options.displayName
	};
}