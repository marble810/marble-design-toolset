/**
 * Desktop Forge builder service integration tests (real tool-builder pipeline on a
 * fixture Tool Project):
 * - a successful build publishes an immutable build dir + Desktop Catalog entry +
 *   `.deshelf/` declarations;
 * - a rebuild of unchanged sources is served from cache (byte-identical artifacts);
 * - editing a source invalidates the cache and republishes;
 * - a broken Tool NEVER enters the usable Catalog and never leaves staging.
 */
import { describe, expect, test } from 'bun:test';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { desktopCatalogEntryId, DesktopCatalogService } from '../src/main/catalog-service.ts';
import { DesktopBuilderService } from '../src/main/builder-service.ts';
import { InProcessBuildExecutor } from '../src/main/controlled-build.ts';
import { createDevForgeProfileResolver } from '../src/main/forge-resources.ts';
import { readProjectLocation } from '../src/main/project-location.ts';

const PROJECT_ID = '3e5a1c9b-7d24-4f8e-9a31-b2c8d6e4f5a7';
const BOOTSTRAP_ENTRY = path.resolve(import.meta.dir, '../src/container/bootstrap.ts');

const FIXTURE_INDEX = `import { defineVisualTool } from '@deshelf/tool-sdk';

export default defineVisualTool({
	parameters: {
		intensity: {
			type: 'number',
			label: 'Intensity',
			default: 0.5,
			mode: 'manual',
			constraint: { type: 'number', min: 0, max: 1, step: 0.01 }
		}
	},
	commands: {},
	privateCallbacks: {},
	outputs: {},
	canvas: () => import('./canvas/Canvas.svelte'),
	dispose() {}
});
`;

const FIXTURE_CANVAS = `<script lang="ts">
	let props = $props();
</script>

<div data-fixture-canvas>{props.context.sessionId}</div>
`;

const FIXTURE_MANIFEST = {
	contractVersion: 1,
	projectId: PROJECT_ID,
	slug: 'desktop-fixture',
	name: 'Desktop Fixture',
	version: '1.0.0',
	forgeProfile: 'forge-v1',
	libraries: []
};

async function makeProject(): Promise<string> {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'deshelf-desktop-fixture-'));
	await fs.writeFile(path.join(dir, 'manifest.json'), JSON.stringify(FIXTURE_MANIFEST), 'utf8');
	await fs.writeFile(path.join(dir, 'index.ts'), FIXTURE_INDEX, 'utf8');
	await fs.mkdir(path.join(dir, 'canvas'), { recursive: true });
	await fs.writeFile(path.join(dir, 'canvas', 'Canvas.svelte'), FIXTURE_CANVAS, 'utf8');
	return dir;
}

async function makeCacheRoot(): Promise<string> {
	return fs.mkdtemp(path.join(os.tmpdir(), 'deshelf-desktop-builder-'));
}

function createService(cacheRoot: string, projectDir: string): { service: DesktopBuilderService; catalog: DesktopCatalogService } {
	const catalog = new DesktopCatalogService(cacheRoot);
	const service = new DesktopBuilderService(cacheRoot, {
		executor: new InProcessBuildExecutor(),
		resolveForgeProfile: createDevForgeProfileResolver(),
		bootstrapEntry: BOOTSTRAP_ENTRY,
		catalog,
		log: () => {}
	});
	void projectDir;
	return { service, catalog };
}

describe('DesktopBuilderService (integration)', () => {
	test('build → publish → cache → invalidate → republish', async () => {
		const cacheRoot = await makeCacheRoot();
		const projectDir = await makeProject();
		const { service, catalog } = createService(cacheRoot, projectDir);
		const location = await readProjectLocation(projectDir);
		expect(location.ok).toBe(true);
		if (!location.ok) return;

		// 1. First build: publishes entry + container page + declarations.
		const first = await service.build(location.location);
		expect(first.ok).toBe(true);
		expect(first.fromCache).toBe(false);
		expect(first.entry?.catalogEntryId).toBe(desktopCatalogEntryId(location.location.info.projectLocationId, PROJECT_ID));

		const buildUrl = new URL(first.containerUrl ?? '');
		// URL shape: deshelf-cache://builds/<locId>/<hash>/container.html
		expect(buildUrl.host).toBe('builds');
		const buildDir = path.join(cacheRoot, 'builds', decodeURIComponent(buildUrl.pathname).replace(/^\//, ''));
		// buildDir points at container.html inside the build directory
		const buildRoot = path.dirname(buildDir);
		expect(await fs.stat(path.join(buildRoot, 'container.html')).then(() => true).catch(() => false)).toBe(true);
		expect(await fs.stat(path.join(buildRoot, 'artifacts', 'main.js')).then(() => true).catch(() => false)).toBe(true);
		const containerHtml = await fs.readFile(path.join(buildRoot, 'container.html'), 'utf8');
		expect(containerHtml).toContain('importmap');

		const records = await catalog.listRecords();
		expect(records).toHaveLength(1);
		expect(records[0].entry.parameters.intensity?.id).toBe('intensity');

		// .deshelf declarations written into the Tool Project + .gitignore maintained.
		expect(await fs.stat(path.join(projectDir, '.deshelf', 'parameters.d.ts')).then(() => true).catch(() => false)).toBe(true);
		expect(await fs.readFile(path.join(projectDir, '.gitignore'), 'utf8')).toContain('.deshelf/');

		// 2. Rebuild of unchanged sources: served from cache, no new build dir.
		const second = await service.build(location.location);
		expect(second.ok).toBe(true);
		expect(second.fromCache).toBe(true);
		expect(second.containerUrl).toBe(first.containerUrl);

		// 3. Source edit invalidates the cache and republishes under a new hash.
		await new Promise((resolve) => setTimeout(resolve, 20));
		await fs.writeFile(
			path.join(projectDir, 'index.ts'),
			FIXTURE_INDEX.replace('default: 0.5', 'default: 0.75'),
			'utf8'
		);
		const reloaded = await readProjectLocation(projectDir);
		expect(reloaded.ok).toBe(true);
		if (!reloaded.ok) return;
		const third = await service.build(reloaded.location);
		expect(third.ok).toBe(true);
		expect(third.fromCache).toBe(false);
		expect(third.containerUrl).not.toBe(first.containerUrl);
		// Same catalogEntryId — Reload upserts the same Location entry.
		expect(third.entry?.catalogEntryId).toBe(first.entry?.catalogEntryId);
		const mainArtifact = await fs.readFile(path.join(path.dirname(new URL(third.containerUrl ?? 'file://x/').pathname.replace(/^\//, '')), 'noop'), 'utf8').catch(() => null);
		void mainArtifact;
	}, 120_000);

	test('a broken Tool Project never enters the usable Catalog', async () => {
		const cacheRoot = await makeCacheRoot();
		const projectDir = await makeProject();
		await fs.writeFile(path.join(projectDir, 'index.ts'), 'export const not_a_tool = true;\n', 'utf8');
		const { service, catalog } = createService(cacheRoot, projectDir);
		const location = await readProjectLocation(projectDir);
		expect(location.ok).toBe(true);
		if (!location.ok) return;

		const outcome = await service.build(location.location);
		expect(outcome.ok).toBe(false);
		expect(outcome.diagnostics.length).toBeGreaterThan(0);
		expect(await catalog.listRecords()).toHaveLength(0);
		// No build dir was published.
		const buildsDir = path.join(cacheRoot, 'builds', location.location.info.projectLocationId);
		expect(await fs.readdir(buildsDir).catch(() => [])).toEqual([]);
	});
});
