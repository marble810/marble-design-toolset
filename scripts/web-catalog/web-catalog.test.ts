/**
 * Web static Catalog generation tests: scanning convention rules, shared builder
 * integration, atomic publish semantics (failed projects never enter the Catalog, the
 * catalog.json swap is atomic, stale artifacts are pruned) and container page output.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { catalogEntryId, validateCatalogEntry } from 'tool-contract';
import {
	generateWebCatalog,
	expectedEntryId,
	WEB_CATALOG_VERSION,
	WEB_RELEASE_RETENTION_MS
} from './generate.ts';
import { collectBareImports, specifierToStem } from './lib-bundles.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const FIXTURE_PROJECTS = path.join(REPO_ROOT, 'packages', 'tool-builder', 'fixtures', 'projects');

let tempRoot: string;

beforeAll(async () => {
	tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'deshelf-web-catalog-'));
});

afterAll(async () => {
	await fs.rm(tempRoot, { recursive: true, force: true });
});

/** Copies fixture Tool Projects into a fresh tools root. */
async function makeToolsRoot(names: string[]): Promise<string> {
	const root = path.join(tempRoot, `tools-${Math.random().toString(36).slice(2, 8)}`);
	await fs.mkdir(root, { recursive: true });
	for (const name of names) {
		await fs.cp(path.join(FIXTURE_PROJECTS, name), path.join(root, name), { recursive: true });
	}
	return root;
}

function makeOutRoot(): string {
	return path.join(tempRoot, `out-${Math.random().toString(36).slice(2, 8)}`);
}

interface CatalogFile {
	version: number;
	source: { kind: string; sourceId: string };
	entries: Array<{ catalogEntryId: string; projectId: string; slug: string; artifacts: { main: string; slate?: string } }>;
}

async function readCatalog(outRoot: string): Promise<CatalogFile> {
	return JSON.parse(await fs.readFile(path.join(outRoot, 'catalog.json'), 'utf8')) as CatalogFile;
}

function releasePrefix(artifactPath: string): string {
	const marker = '/artifacts/';
	const index = artifactPath.indexOf(marker);
	assert.ok(index > 0, `artifact must live in an immutable release: ${artifactPath}`);
	return artifactPath.slice(0, index);
}

describe('collectBareImports', () => {
	test('finds static, dynamic and side-effect imports; ignores relative and node:', () => {
		const source = [
			"import { mount } from 'svelte';",
			"import * as client from 'svelte/internal/client';",
			"import './chunks/relative.js';",
			"import('three');",
			"import 'side-effect';",
			"import fs from 'node:fs';",
			"const x = await import('#internal');"
		].join('\n');
		expect(collectBareImports(source).sort()).toEqual(['side-effect', 'svelte', 'svelte/internal/client', 'three']);
	});

	test('specifierToStem flattens separators', () => {
		expect(specifierToStem('svelte/internal/client')).toBe('svelte__internal__client');
	});
});

describe('generateWebCatalog', () => {
	test('builds the fixture projects into a validated static catalog', async () => {
		const toolsRoot = await makeToolsRoot(['valid', 'with-slate', 'throwing-inspector']);
		const outRoot = makeOutRoot();
		const result = await generateWebCatalog({ toolsRoot, outRoot, log: () => {} });

		// Only successful builds are usable; the throwing Inspector must be excluded.
		expect(result.entries.map((e) => e.slug).sort()).toEqual(['shallow-water', 'with-slate']);
		expect(result.failures.map((f) => f.folderName)).toEqual(['throwing-inspector']);
		expect(result.failures[0].stage).toBe('build');

		const file = await readCatalog(outRoot);
		expect(file.version).toBe(WEB_CATALOG_VERSION);
		expect(file.source).toEqual({ kind: 'web', sourceId: 'bundled' });
		for (const entry of file.entries) {
			assert.ok(validateCatalogEntry(entry).ok, `entry ${entry.slug} must validate`);
			expect(entry.catalogEntryId).toBe(expectedEntryId('bundled', entry.projectId));
			expect(entry.artifacts.main).toMatch(new RegExp(`^releases/[^/]+/artifacts/${entry.slug}/`));
		}
		// Slate entry references the dynamic slate chunk.
		const slateEntry = file.entries.find((e) => e.slug === 'with-slate');
		assert.ok(slateEntry?.artifacts.slate !== undefined);

		// Published outputs coexist in the same immutable release.
		const release = releasePrefix(file.entries[0].artifacts.main);
		await fs.access(path.join(outRoot, release, 'container.html'));
		await fs.access(path.join(outRoot, release, 'container-bootstrap.js'));
		await fs.access(path.join(outRoot, release, 'libs', 'svelte.js'));
		await fs.access(path.join(outRoot, file.entries.find((entry) => entry.slug === 'shallow-water')!.artifacts.main));

		// The release-local container page carries the import map.
		const page = await fs.readFile(path.join(outRoot, release, 'container.html'), 'utf8');
		assert.match(page, /"svelte":\s*"\.\/libs\/svelte\.js"/);
		assert.match(page, /type="importmap"/);
		assert.match(page, /container-bootstrap\.js/);

		// No staging leftovers.
		const remaining = await fs.readdir(outRoot);
		expect(remaining.filter((name) => name.startsWith('.staging'))).toEqual([]);
	});

	test('retains recent releases for old readers and prunes them after the safety window', async () => {
		const toolsRoot = await makeToolsRoot(['valid', 'with-slate']);
		const outRoot = makeOutRoot();
		await generateWebCatalog({ toolsRoot, outRoot, log: () => {} });
		const firstCatalog = await readCatalog(outRoot);
		const firstRelease = releasePrefix(firstCatalog.entries[0].artifacts.main);

		const second = await generateWebCatalog({ toolsRoot, outRoot, log: () => {} });
		expect(second.entries.length).toBe(2);
		const secondCatalog = await readCatalog(outRoot);
		const secondRelease = releasePrefix(secondCatalog.entries[0].artifacts.main);
		expect(secondRelease).not.toBe(firstRelease);
		await fs.access(path.join(outRoot, firstRelease));

		// Once the first release is older than the reader-safety window, a later
		// publication may collect it while retaining the recent previous release.
		const expired = new Date(Date.now() - WEB_RELEASE_RETENTION_MS - 1_000);
		await fs.utimes(path.join(outRoot, firstRelease), expired, expired);
		await generateWebCatalog({ toolsRoot, outRoot, log: () => {} });
		await expect(fs.access(path.join(outRoot, firstRelease))).rejects.toThrow();
		await fs.access(path.join(outRoot, secondRelease));
		const currentCatalog = await readCatalog(outRoot);
		const currentRelease = releasePrefix(currentCatalog.entries[0].artifacts.main);
		const artifacts = await fs.readdir(path.join(outRoot, currentRelease, 'artifacts'));
		expect(artifacts.sort()).toEqual(['shallow-water', 'with-slate']);
	});

	test('failed rebuilds publish a consistent catalog and clean staging state', async () => {
		const toolsRoot = await makeToolsRoot(['valid']);
		const outRoot = makeOutRoot();
		await generateWebCatalog({ toolsRoot, outRoot, log: () => {} });
		const first = await readCatalog(outRoot);
		expect(first.entries.length).toBe(1);
		const firstRelease = releasePrefix(first.entries[0].artifacts.main);

		// Remove the entry file from the project → the tool can no longer build → the next
		// Catalog excludes it, while the prior immutable release remains briefly available
		// to clients that already fetched the old Catalog.
		await fs.rm(path.join(toolsRoot, 'valid', 'index.ts'));
		const second = await generateWebCatalog({ toolsRoot, outRoot, log: () => {} });
		expect(second.entries.length).toBe(0);
		const after = await readCatalog(outRoot);
		expect(after.entries.length).toBe(0);
		await fs.access(path.join(outRoot, firstRelease));
		// No temp/staging leftovers from the swap.
		const remaining = await fs.readdir(outRoot);
		expect(remaining.filter((name) => name.startsWith('.staging') || name.endsWith('.tmp'))).toEqual([]);
	});

	test('ignores foreign directories and reports broken Deshelf manifests', async () => {
		const toolsRoot = await makeToolsRoot([]);
		// A legacy-style tool directory without a manifest is ignored entirely.
		await fs.mkdir(path.join(toolsRoot, 'legacy-tool'), { recursive: true });
		await fs.writeFile(path.join(toolsRoot, 'legacy-tool', 'metadata.json'), '{}', 'utf8');
		// A foreign manifest without Deshelf identity fields is ignored.
		await fs.mkdir(path.join(toolsRoot, 'foreign'), { recursive: true });
		await fs.writeFile(path.join(toolsRoot, 'foreign', 'manifest.json'), JSON.stringify({ name: 'not-deshelf' }), 'utf8');
		// A Deshelf-looking manifest that fails validation is reported.
		await fs.mkdir(path.join(toolsRoot, 'broken'), { recursive: true });
		await fs.writeFile(
			path.join(toolsRoot, 'broken', 'manifest.json'),
			JSON.stringify({ contractVersion: 1, projectId: 'x', slug: 'BROKEN SLUG', name: 'Broken', version: 'not-semver', forgeProfile: 'forge-v1', libraries: [] }),
			'utf8'
		);

		// A manifest file with invalid JSON is also a broken Tool candidate and must not
		// disappear silently merely because its identity fields cannot be parsed.
		await fs.mkdir(path.join(toolsRoot, 'malformed'), { recursive: true });
		await fs.writeFile(path.join(toolsRoot, 'malformed', 'manifest.json'), '{ invalid json', 'utf8');

		const result = await generateWebCatalog({ toolsRoot, outRoot: makeOutRoot(), log: () => {} });
		expect(result.entries).toEqual([]);
		expect(result.failures.map((f) => f.folderName)).toEqual(['broken', 'malformed']);
		expect(result.failures.find((failure) => failure.folderName === 'malformed')?.diagnostics[0].code).toBe('build/manifest-read');
	});

	test('duplicate slugs fail deterministically (first candidate wins)', async () => {
		const toolsRoot = await makeToolsRoot(['valid', 'with-slate']);
		// Both fixtures have distinct slugs; clone one under a different folder with the
		// same slug but a different project id to trigger the slug guard.
		const clone = path.join(toolsRoot, 'valid-clone');
		await fs.cp(path.join(toolsRoot, 'valid'), clone, { recursive: true });
		const manifestPath = path.join(clone, 'manifest.json');
		const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as Record<string, unknown>;
		manifest.projectId = 'aaaaaaaa-1111-4222-8333-444455556666';
		await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

		const result = await generateWebCatalog({ toolsRoot, outRoot: makeOutRoot(), log: () => {} });
		expect(result.failures).toHaveLength(1);
		expect(result.failures[0].reason).toBe('duplicate-slug');
		expect(result.entries.map((e) => e.projectId)).not.toContain('aaaaaaaa-1111-4222-8333-444455556666');
		void catalogEntryId;
	});
});
