/**
 * Web static Catalog generation (Deshelf Forge for the Web app):
 *
 *   scan tools/ → build each Tool Project via the shared tool-builder → enumerate bare
 *   imports of the compiled artifacts → pre-build Framework Library bundles → build the
 *   container bootstrap + chrome page → stage one immutable release → publish that
 *   release with one rename → atomically swap catalog.json (the availability boundary)
 *   → prune older releases.
 *
 * Failed builds NEVER enter the usable Catalog: they are reported as failures with
 * diagnostics and simply have no Catalog Entry. Catalog entries point into an immutable
 * release, so readers never observe a catalog whose artifacts are being overwritten.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as viteBuild } from 'vite';
import {
	CatalogStore,
	buildToolProject,
	DEFAULT_TOOL_BUILDER_ENVIRONMENT,
	type ToolBuilderEnvironment
} from 'tool-builder';
import { catalogEntryId, type CatalogEntry, type CatalogSourceRef, type Diagnostic } from 'tool-contract';
import { scanToolProjects, type ToolProjectFailure } from './scan.ts';
import { ALWAYS_SUPPLIED_SPECIFIERS, bundleFrameworkLibs, collectArtifactImports } from './lib-bundles.ts';
import { renderContainerPage } from './container-page.ts';

export const WEB_CATALOG_VERSION = 1;
/** Old Catalog readers may still start/restart containers after a pointer swap. */
export const WEB_RELEASE_RETENTION_MS = 24 * 60 * 60 * 1000;

/** Where the container bootstrap source lives (browser module inside the web app). */
const BOOTSTRAP_ENTRY = fileURLToPath(new URL('../../src/lib/forge/container/bootstrap-main.ts', import.meta.url));

export interface GenerateWebCatalogInput {
	/** Convention root containing Tool Project directories. */
	toolsRoot: string;
	/** Static output root (e.g. `static/deshelf`). Created when missing. */
	outRoot: string;
	/** Web Catalog Source id baked into every entry (default 'bundled'). */
	sourceId?: string;
	environment?: ToolBuilderEnvironment;
	/** Extraction evaluation timeout forwarded to the shared builder. */
	extractionTimeoutMs?: number;
	log?: (message: string) => void;
}

export interface GenerateWebCatalogFailure extends ToolProjectFailure {
	stage: 'scan' | 'build';
}

export interface GenerateWebCatalogResult {
	entries: CatalogEntry[];
	failures: GenerateWebCatalogFailure[];
}

function relativeArtifactPaths(entry: CatalogEntry, releaseName: string): CatalogEntry {
	// The builder reports artifact file names relative to its outDir; the static catalog
	// points at the immutable release that owns artifacts, libraries and container page.
	const prefix = `releases/${releaseName}/artifacts/${entry.slug}`;
	return {
		...entry,
		artifacts: {
			main: `${prefix}/${entry.artifacts.main}`,
			...(entry.artifacts.slate !== undefined ? { slate: `${prefix}/${entry.artifacts.slate}` } : {})
		}
	};
}

async function pathExists(target: string): Promise<boolean> {
	try {
		await fs.stat(target);
		return true;
	} catch {
		return false;
	}
}

async function removeTree(target: string): Promise<void> {
	await fs.rm(target, { recursive: true, force: true });
}

/** Builds the container bootstrap bundle (imports `svelte` externally via import map). */
async function buildBootstrap(outFile: string, log?: (message: string) => void): Promise<void> {
	await viteBuild({
		configFile: false,
		logLevel: 'error',
		build: {
			outDir: path.dirname(outFile),
			emptyOutDir: false,
			sourcemap: false,
			minify: false,
			target: 'esnext',
			rollupOptions: {
				input: BOOTSTRAP_ENTRY,
				// `svelte` is supplied through the container page import map; the entry URL
				// is imported at runtime with @vite-ignore.
				external: (id) => id === 'svelte' || id.startsWith('svelte/'),
				output: {
					format: 'es',
					entryFileNames: path.basename(outFile)
				}
			}
		}
	});
	log?.('[forge] built container bootstrap bundle');
}

export async function generateWebCatalog(input: GenerateWebCatalogInput): Promise<GenerateWebCatalogResult> {
	const log = input.log ?? (() => {});
	const source: CatalogSourceRef = { kind: 'web', sourceId: input.sourceId ?? 'bundled' };
	const outRoot = path.resolve(input.outRoot);
	const failures: GenerateWebCatalogFailure[] = [];

	// 1. Scan for candidate Tool Projects (foreign directories are ignored).
	const scan = await scanToolProjects(input.toolsRoot);
	for (const failure of scan.failures) failures.push({ ...failure, stage: 'scan' });

	// 2. Build every candidate with the shared builder into a staging tree. Its unique
	// name becomes the immutable release name after publication.
	const releaseName = `release-${Date.now().toString(36)}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
	const staging = path.join(outRoot, `.staging-${releaseName}`);
	await fs.mkdir(staging, { recursive: true });
	const store = new CatalogStore();
	const artifactsStaging = path.join(staging, 'artifacts');
	const builtSlugs: string[] = [];
	for (const candidate of scan.candidates) {
		const outDir = path.join(artifactsStaging, candidate.manifest.slug);
		log(`[forge] building Tool Project '${candidate.manifest.slug}' (${candidate.folderName})`);
		const outcome = await buildToolProject({
			projectDir: candidate.projectDir,
			outDir,
			source,
			store,
			environment: input.environment ?? DEFAULT_TOOL_BUILDER_ENVIRONMENT,
			extractionTimeoutMs: input.extractionTimeoutMs
		});
		if (outcome.ok) {
			builtSlugs.push(candidate.manifest.slug);
		} else {
			// A failed Tool Project never becomes a usable Catalog Entry.
			log(`[forge] FAILED '${candidate.folderName}': ${outcome.diagnostics.map((d) => `${d.code} ${d.message}`).join('; ')}`);
			failures.push({ projectDir: candidate.projectDir, folderName: candidate.folderName, reason: 'build', stage: 'build', diagnostics: outcome.diagnostics });
		}
	}

	// 3. Framework Library supply: enumerate bare imports across all built artifacts.
	const specifiers = new Set<string>(ALWAYS_SUPPLIED_SPECIFIERS);
	for (const slug of builtSlugs) {
		for (const specifier of await collectArtifactImports(path.join(artifactsStaging, slug))) {
			specifiers.add(specifier);
		}
	}
	const libsDir = path.join(staging, 'libs');
	const { importMap } = await bundleFrameworkLibs({ specifiers: [...specifiers], outDir: libsDir, log });

	// 4. Container chrome page + bootstrap bundle. Tool-owned Svelte styles are
	// extracted as assets; the container page links them (Svelte scope hashes prevent
	// cross-tool leakage).
	await buildBootstrap(path.join(staging, 'container-bootstrap.js'), log);
	const stylesheetUrls: string[] = [];
	for (const slug of builtSlugs) {
		const assetsDir = path.join(artifactsStaging, slug, 'assets');
		if (!(await pathExists(assetsDir))) continue;
		for (const dirent of await fs.readdir(assetsDir, { withFileTypes: true })) {
			if (dirent.isFile() && dirent.name.endsWith('.css')) {
				stylesheetUrls.push(`./artifacts/${slug}/assets/${dirent.name}`);
			}
		}
	}
	await fs.writeFile(
		path.join(staging, 'container.html'),
		renderContainerPage({ importMap, bootstrapUrl: './container-bootstrap.js', stylesheetUrls }),
		'utf8'
	);

	// 5. Publish the complete immutable release first, then atomically switch the
	// Catalog pointer. Until the catalog rename, every existing catalog still references
	// an untouched previous release.
	const entries = store.list().map((entry) => relativeArtifactPaths(entry, releaseName));
	const catalogFile = { version: WEB_CATALOG_VERSION, source, entries };
	const releasesRoot = path.join(outRoot, 'releases');
	const releaseRoot = path.join(releasesRoot, releaseName);

	await fs.mkdir(releasesRoot, { recursive: true });
	await fs.rename(staging, releaseRoot);
	const catalogTmp = path.join(outRoot, `catalog.json.${releaseName}.tmp`);
	await fs.writeFile(catalogTmp, `${JSON.stringify(catalogFile, null, 2)}\n`, 'utf8');
	await fs.rename(catalogTmp, path.join(outRoot, 'catalog.json'));

	// 6. Retain recent immutable releases so a client that fetched the previous Catalog
	// can still start or restart its Tool. Deployment-aware GC removes only releases
	// older than the safety window; the newly published release is always retained.
	const releaseCutoff = Date.now() - WEB_RELEASE_RETENTION_MS;
	for (const dirent of await fs.readdir(releasesRoot, { withFileTypes: true })) {
		if (!dirent.isDirectory() || dirent.name === releaseName) continue;
		const staleRelease = path.join(releasesRoot, dirent.name);
		const stats = await fs.stat(staleRelease);
		if (stats.mtimeMs < releaseCutoff) {
			log(`[forge] pruning expired release '${dirent.name}'`);
			await removeTree(staleRelease);
		}
	}
	for (const legacyPath of ['artifacts', 'libs', 'container.html', 'container-bootstrap.js']) {
		await removeTree(path.join(outRoot, legacyPath));
	}

	return { entries, failures };
}

/** Deterministic re-derivation used by tests to assert entry identity. */
export function expectedEntryId(sourceId: string, projectId: string): string {
	return catalogEntryId({ kind: 'web', sourceId }, projectId);
}
