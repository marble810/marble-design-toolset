import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export const SUPPORTED_TECH_STACKS = ['three', 'pixi', 'gsap'];

const REQUIRED_METADATA_FIELDS = ['name', 'desc', 'tag', 'version'];

export async function validateToolsRoot(toolsRoot) {
	const entries = await readdir(toolsRoot, { withFileTypes: true });
	const errors = [];

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		errors.push(...(await validateToolDirectory(path.join(toolsRoot, entry.name), entry.name)));
	}

	return errors;
}

export async function validateToolDirectory(toolDir, toolId = path.basename(toolDir)) {
	const errors = [];
	const entries = await readdir(toolDir, { withFileTypes: true });
	const rootSvelteFiles = entries
		.filter((entry) => entry.isFile() && entry.name.endsWith('.svelte'))
		.map((entry) => entry.name);
	const expectedMaster = `${kebabToPascal(toolId)}.svelte`;

	if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(toolId)) {
		errors.push(createError(toolId, `tool-id must be kebab-case starting with a letter: ${toolId}`));
	}

	if (!entries.some((entry) => entry.isFile() && entry.name === 'index.ts')) {
		errors.push(createError(toolId, 'missing index.ts'));
	}

	if (!entries.some((entry) => entry.isFile() && entry.name === 'metadata.json')) {
		errors.push(createError(toolId, 'missing metadata.json'));
	} else {
		errors.push(...(await validateMetadata(path.join(toolDir, 'metadata.json'), toolId)));
	}

	if (rootSvelteFiles.length !== 1) {
		errors.push(createError(toolId, `expected exactly one root-level .svelte file, found ${rootSvelteFiles.length}`));
	} else if (rootSvelteFiles[0] !== expectedMaster) {
		errors.push(createError(toolId, `expected master component ${expectedMaster}, found ${rootSvelteFiles[0]}`));
	}

	errors.push(...(await validatePrivateSvelteLocations(toolDir, toolId)));

	if (entries.some((entry) => entry.isFile() && entry.name === 'index.ts')) {
		errors.push(...(await validateDefinition(path.join(toolDir, 'index.ts'), toolId)));
	}

	return errors;
}

async function validateMetadata(metadataPath, toolId) {
	const errors = [];
	let metadata;

	try {
		metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
	} catch (error) {
		return [createError(toolId, `metadata.json is not valid JSON: ${error.message}`)];
	}

	for (const field of REQUIRED_METADATA_FIELDS) {
		if (!(field in metadata)) {
			errors.push(createError(toolId, `metadata.json missing required field: ${field}`));
		}
	}

	if (typeof metadata.name !== 'string' || metadata.name.trim() === '') {
		errors.push(createError(toolId, 'metadata.name must be a non-empty string'));
	}

	if (typeof metadata.desc !== 'string' || metadata.desc.trim() === '') {
		errors.push(createError(toolId, 'metadata.desc must be a non-empty string'));
	}

	if (!Array.isArray(metadata.tag) || metadata.tag.some((tag) => typeof tag !== 'string')) {
		errors.push(createError(toolId, 'metadata.tag must be an array of strings'));
	}

	if (typeof metadata.version !== 'string' || metadata.version.trim() === '') {
		errors.push(createError(toolId, 'metadata.version must be a non-empty string'));
	}

	if ('techStack' in metadata) {
		errors.push(createError(toolId, 'metadata.json must not contain runtime techStack'));
	}

	return errors;
}

async function validatePrivateSvelteLocations(toolDir, toolId) {
	const errors = [];
	const svelteFiles = await listFiles(toolDir, (filePath) => filePath.endsWith('.svelte'));

	for (const filePath of svelteFiles) {
		const relativePath = path.relative(toolDir, filePath);
		const segments = relativePath.split(path.sep);
		if (segments.length > 1 && segments[0] !== 'components') {
			errors.push(createError(toolId, `private Svelte component must live under components/: ${relativePath}`));
		}
	}

	return errors;
}

async function validateDefinition(indexPath, toolId) {
	const source = await readFile(indexPath, 'utf8');
	const errors = [];

	if (!/export\s+default\s+definition\s*;?/.test(source)) {
		errors.push(createError(toolId, 'index.ts must default-export the tool definition'));
	}

	for (const techStack of extractTechStackKeys(source)) {
		if (!SUPPORTED_TECH_STACKS.includes(techStack)) {
			errors.push(createError(toolId, `unsupported tech stack: ${techStack}`));
		}
	}

	return errors;
}

function extractTechStackKeys(source) {
	const match = source.match(/techStack\s*:\s*\[([^\]]*)\]/s);
	if (!match) return [];
	const values = [];
	const quotedValuePattern = /['"]([^'"]+)['"]/g;
	let valueMatch;
	while ((valueMatch = quotedValuePattern.exec(match[1]))) {
		values.push(valueMatch[1]);
	}
	return values;
}

async function listFiles(dir, predicate) {
	const results = [];
	const entries = await readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		const filePath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			results.push(...(await listFiles(filePath, predicate)));
		} else if (entry.isFile() && predicate(filePath)) {
			results.push(filePath);
		}
	}

	return results;
}

function kebabToPascal(value) {
	return value
		.split('-')
		.filter(Boolean)
		.map((token) => `${token[0].toUpperCase()}${token.slice(1)}`)
		.join('');
}

function createError(toolId, message) {
	return { toolId, message };
}

export async function pathExists(filePath) {
	try {
		await stat(filePath);
		return true;
	} catch {
		return false;
	}
}