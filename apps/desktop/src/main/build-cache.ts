/**
 * Build cache: content-addressed build outputs for Open Projects.
 *
 * A build's cache key is a SHA-256 over the Tool Project's source files (manifest,
 * fixed entry, all .ts/.svelte/.css/.json sources, sorted by relative path). Editing
 * any source invalidates the cache; an unchanged project is never rebuilt — the
 * previous immutable build output (and its Catalog entry) is reused as-is.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { buildDirFor, createCachePaths, type DesktopCachePaths } from './paths.ts';
import type { CatalogEntry } from 'tool-contract';
import { validateCatalogEntry } from 'tool-contract';

const SOURCE_EXTENSIONS = new Set(['.ts', '.svelte', '.css', '.json']);

async function collectSourceFiles(projectDir: string, base: string, out: Array<{ rel: string; abs: string }>): Promise<void> {
	for (const dirent of await fs.readdir(base, { withFileTypes: true })) {
		const abs = path.join(base, dirent.name);
		if (dirent.isDirectory()) {
			// `.deshelf/` is generated IDE output — never part of the build identity.
			if (dirent.name === '.deshelf' || dirent.name === 'node_modules') continue;
			await collectSourceFiles(projectDir, abs, out);
		} else if (dirent.isFile() && SOURCE_EXTENSIONS.has(path.extname(dirent.name))) {
			out.push({ rel: path.relative(projectDir, abs).replace(/\\/g, '/'), abs });
		}
	}
}

export async function hashProjectSources(projectDir: string): Promise<string> {
	const files: Array<{ rel: string; abs: string }> = [];
	await collectSourceFiles(projectDir, projectDir, files);
	files.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
	const hash = createHash('sha256');
	for (const file of files) {
		hash.update(file.rel);
		hash.update('\0');
		hash.update(await fs.readFile(file.abs));
		hash.update('\0');
	}
	return hash.digest('hex').slice(0, 24);
}

/** A cached build: its directory plus the persisted, re-validated Catalog entry. */
export interface CachedBuild {
	buildDir: string;
	sourceHash: string;
	entry: CatalogEntry;
}

/**
 * Looks up a successful build for this Location + source hash. The persisted entry is
 * re-validated on read: a corrupt cache file behaves like a cache miss, never like a
 * broken Catalog.
 */
export async function findCachedBuild(
	cacheRoot: string,
	projectLocationId: string,
	sourceHash: string
): Promise<CachedBuild | undefined> {
	const paths: DesktopCachePaths = createCachePaths(cacheRoot);
	const buildDir = buildDirFor(paths, projectLocationId, sourceHash);
	let raw: unknown;
	try {
		raw = JSON.parse(await fs.readFile(path.join(buildDir, 'catalog.json'), 'utf8'));
	} catch {
		return undefined;
	}
	const validation = validateCatalogEntry(raw);
	if (!validation.ok) return undefined;
	// The cached artifacts must actually still exist — a pruned/partial cache is a miss.
	// Artifacts are stored buildDir-relative (`artifacts/…`).
	const artifactPath = path.join(buildDir, validation.value.artifacts.main);
	try {
		await fs.access(artifactPath);
	} catch {
		return undefined;
	}
	return { buildDir, sourceHash, entry: validation.value };
}
