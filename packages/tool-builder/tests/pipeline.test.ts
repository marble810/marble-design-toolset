import { test, describe, beforeAll, afterAll } from 'bun:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { catalogEntryId, assertSerializable } from 'tool-contract';
import {
	CatalogStore,
	buildToolProject,
	DEFAULT_EXTRACTION_TIMEOUT_MS,
	DEFAULT_TOOL_BUILDER_ENVIRONMENT
} from '../src/index.ts';
import type { BuildToolProjectOutcome, ToolBuilderEnvironment } from '../src/index.ts';

const FIXTURES = path.resolve(import.meta.dirname, '../fixtures/projects');
const SOURCE = { kind: 'desktop', projectLocationId: 'pipeline-loc' } as const;

describe('buildToolProject pipeline', () => {
	let tempRoot: string;
	let validDir: string;
	let slateDir: string;
	let throwingDir: string;
	let hangingDir: string;
	let outCounter = 0;

	beforeAll(async () => {
		tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'deshelf-pipeline-'));
		validDir = path.join(tempRoot, 'valid');
		slateDir = path.join(tempRoot, 'with-slate');
		throwingDir = path.join(tempRoot, 'throwing-inspector');
		hangingDir = path.join(tempRoot, 'hanging-inspector');
		await fs.cp(path.join(FIXTURES, 'valid'), validDir, { recursive: true });
		await fs.cp(path.join(FIXTURES, 'with-slate'), slateDir, { recursive: true });
		await fs.cp(path.join(FIXTURES, 'throwing-inspector'), throwingDir, { recursive: true });
		await fs.cp(path.join(FIXTURES, 'hanging-inspector'), hangingDir, { recursive: true });
	});

	afterAll(async () => {
		await fs.rm(tempRoot, { recursive: true, force: true });
	});

	function freshOutDir(): string {
		outCounter += 1;
		return path.join(tempRoot, `out-${outCounter}`);
	}

	async function build(projectDir: string, overrides: Partial<{ store: CatalogStore; timeoutMs: number; outDir: string; environment: ToolBuilderEnvironment }> = {}): Promise<{
		outcome: BuildToolProjectOutcome;
		store: CatalogStore;
		outDir: string;
	}> {
		const outDir = overrides.outDir ?? freshOutDir();
		const store = overrides.store ?? new CatalogStore();
		const outcome = await buildToolProject({
			projectDir,
			outDir,
			source: SOURCE,
			store,
			...(overrides.environment !== undefined ? { environment: overrides.environment } : {}),
			...('timeoutMs' in overrides ? { extractionTimeoutMs: overrides.timeoutMs } : {})
		});
		return { outcome, store, outDir };
	}

	test('a valid Tool Project builds, publishes and emits functional artifacts', async () => {
		const { outcome, store, outDir } = await build(validDir);
		assert.equal(outcome.ok, true, JSON.stringify(outcome.diagnostics, null, 2));
		if (!outcome.ok || outcome.entry === undefined) return;

		const entry = outcome.entry;
		assert.equal(entry.catalogEntryId, catalogEntryId(SOURCE, entry.projectId));
		assert.equal(entry.slug, 'shallow-water');
		assert.deepEqual(entry.surfaces, { canvas: true, slate: false });
		assert.deepEqual(entry.artifacts, { main: 'main.js' });

		// Catalog stays function-free and JSON-serializable.
		assert.deepEqual(assertSerializable(entry), []);
		const roundTrip = JSON.parse(JSON.stringify(entry));
		assert.deepEqual(roundTrip, entry);
		assert.deepEqual(entry.privateCallbacks, { resimulate: { id: 'resimulate' } });

		// The published entry is the one the store serves.
		assert.equal(store.get(entry.catalogEntryId), entry);

		// The emitted Main artifact exists on disk and retains the callable run
		// implementation, while the Catalog keeps only the callback id.
		const mainPath = path.join(outDir, entry.artifacts.main);
		const stat = await fs.stat(mainPath);
		assert.ok(stat.isFile(), 'main artifact must be emitted');
		const module = (await import(pathToFileURL(mainPath).href)) as {
			default: { privateCallbacks: Record<string, { run: () => string }> };
		};
		assert.equal(module.default.privateCallbacks.resimulate.run(), 'resimulated');
		assert.equal('run' in entry.privateCallbacks.resimulate, false);
	});

	test('Forge Profile resources are resolved through the injectable Builder environment', async () => {
		let requestedProfile = '';
		const environment: ToolBuilderEnvironment = {
			async resolveForgeProfile(profileId) {
				requestedProfile = profileId;
				return DEFAULT_TOOL_BUILDER_ENVIRONMENT.resolveForgeProfile(profileId);
			}
		};
		const { outcome } = await build(validDir, { environment });
		assert.equal(outcome.ok, true, JSON.stringify(outcome.diagnostics));
		assert.equal(requestedProfile, 'forge-v1');
	});

	test('deterministic output: building the same project twice produces identical entries', async () => {
		const first = await build(validDir);
		const second = await build(validDir);
		assert.equal(first.outcome.ok && second.outcome.ok, true, JSON.stringify([first.outcome.diagnostics, second.outcome.diagnostics], null, 2));
		if (!first.outcome.ok || !second.outcome.ok) return;
		assert.deepEqual(second.outcome.entry, first.outcome.entry);
		assert.equal(second.outcome.entry?.catalogEntryId, first.outcome.entry?.catalogEntryId);
	});

	test('an optional Tool Slate is compiled, detected and recorded in the Catalog', async () => {
		const { outcome, store, outDir } = await build(slateDir);
		assert.equal(outcome.ok, true, JSON.stringify(outcome.diagnostics, null, 2));
		if (!outcome.ok || outcome.entry === undefined) return;

		assert.equal(outcome.entry.surfaces.slate, true);
		assert.equal(typeof outcome.entry.artifacts.slate, 'string');
		const slateArtifact = outcome.entry.artifacts.slate as string;
		const slatePath = path.join(outDir, slateArtifact);
		assert.ok((await fs.stat(slatePath)).isFile(), 'slate artifact must be emitted');
		assert.ok(store.has(outcome.entry.catalogEntryId));
	});

	test('a throwing createInspector fails the build and never reaches the Catalog', async () => {
		const { outcome, store } = await build(throwingDir);
		assert.equal(outcome.ok, false);
		assert.equal(outcome.entry, undefined);
		if (!outcome.ok) {
			assert.ok(outcome.diagnostics.some((d) => d.code === 'inspector/extraction-failed'), JSON.stringify(outcome.diagnostics));
		}
		assert.equal(store.list().length, 0, 'failed builds must not be published');
	});

	test('a hanging createInspector is terminated by the worker timeout', async () => {
		const { outcome, store } = await build(hangingDir, { timeoutMs: 700 });
		assert.equal(outcome.ok, false);
		assert.equal(outcome.entry, undefined);
		if (!outcome.ok) {
			assert.ok(outcome.diagnostics.some((d) => d.code === 'extraction/timeout'), JSON.stringify(outcome.diagnostics));
		}
		assert.equal(store.list().length, 0);
	});

	test('DEFAULT_EXTRACTION_TIMEOUT_MS is a positive finite timeout', () => {
		assert.equal(typeof DEFAULT_EXTRACTION_TIMEOUT_MS, 'number');
		assert.ok(DEFAULT_EXTRACTION_TIMEOUT_MS > 0);
	});

	test('rejects output directories that overlap the Tool Project before Vite can delete files', async () => {
		for (const outDir of [validDir, path.join(validDir, 'generated'), tempRoot]) {
			const marker = path.join(validDir, 'manifest.json');
			const before = await fs.readFile(marker, 'utf8');
			const { outcome, store } = await build(validDir, { outDir });
			assert.equal(outcome.ok, false);
			assert.ok(outcome.diagnostics.some((d) => d.code === 'build/output-overlap'));
			assert.equal(await fs.readFile(marker, 'utf8'), before, 'Builder must not mutate or delete Tool Project files');
			assert.equal(store.list().length, 0);
		}
	});

	test('rejects a symlinked output directory that resolves inside the Tool Project', async () => {
		const target = path.join(validDir, 'generated-target');
		const link = path.join(tempRoot, 'linked-output');
		await fs.mkdir(target, { recursive: true });
		try {
			await fs.symlink(target, link, process.platform === 'win32' ? 'junction' : 'dir');
		} catch (err) {
			const code = (err as NodeJS.ErrnoException).code;
			if (code === 'EPERM' || code === 'EACCES' || code === 'ENOSYS') return;
			throw err;
		}
		const marker = await fs.readFile(path.join(validDir, 'manifest.json'), 'utf8');
		const { outcome, store } = await build(validDir, { outDir: link });
		assert.equal(outcome.ok, false);
		assert.ok(outcome.diagnostics.some((d) => d.code === 'build/output-overlap'));
		assert.equal(await fs.readFile(path.join(validDir, 'manifest.json'), 'utf8'), marker);
		assert.equal(store.list().length, 0);
	});

	test('missing manifest.json fails without compiling', async () => {
		const dir = path.join(tempRoot, 'no-manifest');
		await fs.mkdir(dir, { recursive: true });
		await fs.writeFile(path.join(dir, 'index.ts'), `export default {};\n`);
		const { outcome, store } = await build(dir);
		assert.equal(outcome.ok, false);
		if (!outcome.ok) assert.ok(outcome.diagnostics.some((d) => d.code === 'build/manifest-read'));
		assert.equal(store.list().length, 0);
	});

	test('invalid manifest JSON fails with a manifest-read diagnostic', async () => {
		const dir = path.join(tempRoot, 'bad-manifest-json');
		await fs.mkdir(dir, { recursive: true });
		await fs.writeFile(path.join(dir, 'manifest.json'), '{ not json');
		const { outcome, store } = await build(dir);
		assert.equal(outcome.ok, false);
		if (!outcome.ok) assert.ok(outcome.diagnostics.some((d) => d.code === 'build/manifest-read'));
		assert.equal(store.list().length, 0);
	});

	test('a manifest with unknown fields fails closed', async () => {
		const dir = path.join(tempRoot, 'leaky-manifest');
		await fs.mkdir(dir, { recursive: true });
		await fs.writeFile(path.join(dir, 'manifest.json'), JSON.stringify({ contractVersion: 1, projectId: 'p', slug: 'p', name: 'P', version: '1.0.0', forgeProfile: 'forge-v1', libraries: [], enabled: true }));
		await fs.writeFile(path.join(dir, 'index.ts'), `export default {};\n`);
		const { outcome, store } = await build(dir);
		assert.equal(outcome.ok, false);
		if (!outcome.ok) assert.ok(outcome.diagnostics.some((d) => d.code === 'manifest/unknown-field'));
		assert.equal(store.list().length, 0);
	});

	test('missing fixed index.ts fails before compilation', async () => {
		const dir = path.join(tempRoot, 'no-entry');
		await fs.mkdir(dir, { recursive: true });
		await fs.writeFile(path.join(dir, 'manifest.json'), JSON.stringify({ contractVersion: 1, projectId: 'p', slug: 'p', name: 'P', version: '1.0.0', forgeProfile: 'forge-v1', libraries: [] }));
		const { outcome, store } = await build(dir);
		assert.equal(outcome.ok, false);
		if (!outcome.ok) assert.ok(outcome.diagnostics.some((d) => d.code === 'build/entry-missing'));
		assert.equal(store.list().length, 0);
	});

	test('a compile error in the Tool Entry fails the build and never publishes', async () => {
		const dir = path.join(tempRoot, 'compile-error');
		await fs.mkdir(path.join(dir, 'canvas'), { recursive: true });
		await fs.writeFile(path.join(dir, 'manifest.json'), JSON.stringify({ contractVersion: 1, projectId: 'p', slug: 'p', name: 'P', version: '1.0.0', forgeProfile: 'forge-v1', libraries: [] }));
		await fs.writeFile(path.join(dir, 'index.ts'), `import { defineVisualTool } from '@deshelf/tool-sdk';\nexport default defineVisualTool({`);
		await fs.writeFile(path.join(dir, 'canvas/Canvas.svelte'), `<canvas></canvas>`);
		const { outcome, store } = await build(dir);
		assert.equal(outcome.ok, false);
		if (!outcome.ok) assert.ok(outcome.diagnostics.some((d) => d.code === 'build/compile'), JSON.stringify(outcome.diagnostics));
		assert.equal(store.list().length, 0);
	});
});