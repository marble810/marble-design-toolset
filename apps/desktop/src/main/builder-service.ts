/**
 * Desktop Forge build service: Open Project → Catalog Entry.
 *
 *   hash sources → cache hit? serve : controlled build (staging) → publish build dir →
 *   persist Desktop Catalog entry → write `.deshelf/` IDE declarations + .gitignore
 *
 * The cache is content-addressed per Project Location (`builds/<locId>/<sourceHash>`),
 * builds are immutable once published, and a failed build NEVER enters the usable
 * Catalog. Nothing is written back into the Tool Project except the `.deshelf/`
 * declarations (see declarations.ts) — bundles, cache and session state stay in AppData.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { CatalogEntry, CatalogSourceRef, Diagnostic } from 'tool-contract';
import type { ForgeProfileResources } from 'tool-builder';
import { findCachedBuild, hashProjectSources } from './build-cache.ts';
import { desktopSourceFor, DesktopCatalogService } from './catalog-service.ts';
import { writeDeshelfDeclarations } from './declarations.ts';
import { buildDirFor, cacheUrlFor, createCachePaths, tmpDirFor, type DesktopCachePaths } from './paths.ts';
import type { ProjectLocation } from './project-location.ts';
import type { DesktopBuildExecutor } from './controlled-build.ts';

export interface DesktopBuildOutcome {
	ok: boolean;
	fromCache: boolean;
	entry?: CatalogEntry;
	/** Container page URL for the published build (undefined on failure). */
	containerUrl?: string;
	diagnostics: readonly Diagnostic[];
}

export interface DesktopBuilderServiceOptions {
	executor: DesktopBuildExecutor;
	/** Resolves the deployable Forge Profile resources for the Manifest's profile id. */
	resolveForgeProfile: (profileId: string) => Promise<ForgeProfileResources>;
	/** Desktop container bootstrap entry forwarded to the executor. */
	bootstrapEntry: string;
	/** Reuse an existing Desktop Catalog service (defaults to one over `cacheRoot`). */
	catalog?: DesktopCatalogService;
	/** Injected clock for staging dir names (tests pin determinism). */
	now?: () => number;
	log?: (message: string) => void;
}

export class DesktopBuilderService {
	private readonly paths: DesktopCachePaths;
	private readonly catalog: DesktopCatalogService;
	private readonly now: () => number;
	private readonly log: (message: string) => void;

	constructor(
		readonly cacheRoot: string,
		private readonly options: DesktopBuilderServiceOptions
	) {
		this.paths = createCachePaths(cacheRoot);
		this.catalog = options.catalog ?? new DesktopCatalogService(cacheRoot);
		this.now = options.now ?? Date.now;
		this.log = options.log ?? (() => {});
	}

	get catalogs(): DesktopCatalogService {
		return this.catalog;
	}

	/** Builds (or serves from cache) the Open Project and updates the Desktop Catalog. */
	async build(location: ProjectLocation): Promise<DesktopBuildOutcome> {
		const info = location.info;
		await this.catalog.ensureDirs();
		const sourceHash = await hashProjectSources(info.projectDir);

		// 1. Cache hit: reuse the immutable published build, refresh the Catalog.
		const cached = await findCachedBuild(this.cacheRoot, info.projectLocationId, sourceHash);
		if (cached !== undefined) {
			this.log(`[forge] cache hit for '${info.slug}' (${sourceHash})`);
			await this.catalog.upsertEntries(info, [cached.entry]);
			await this.catalog.setCurrentBuild(info.projectLocationId, sourceHash);
			await writeDeshelfDeclarations(info.projectDir, cached.entry);
			return {
				ok: true,
				fromCache: true,
				entry: cached.entry,
				containerUrl: this.containerUrlFor(info.projectLocationId, sourceHash),
				diagnostics: []
			};
		}

		// 2. Controlled build into a staging tree; a failed build never leaves staging.
		const source: CatalogSourceRef = desktopSourceFor(info.projectLocationId);
		const stagingName = `build-${sourceHash.slice(0, 8)}-${this.now().toString(36)}-${process.pid}`;
		const staging = tmpDirFor(this.paths, stagingName);
		await fs.mkdir(staging, { recursive: true });
		const artifactsDir = path.join(staging, 'artifacts');
		const result = await this.options.executor.execute({
			projectDir: info.projectDir,
			outDir: artifactsDir,
			source,
			forgeProfile: await this.options.resolveForgeProfile(location.manifest.forgeProfile),
			bootstrapEntry: this.options.bootstrapEntry,
			log: this.log
		});
		if (!result.ok || result.entry === undefined) {
			await fs.rm(staging, { recursive: true, force: true });
			this.log(`[forge] FAILED '${info.slug}': ${result.diagnostics.map((d) => `${d.code} ${d.message}`).join('; ')}`);
			return { ok: false, fromCache: false, diagnostics: result.diagnostics };
		}

		// 3. Publish: staging → immutable build dir, then persist the Catalog entry.
		const buildDir = buildDirFor(this.paths, info.projectLocationId, sourceHash);
		await fs.rm(buildDir, { recursive: true, force: true });
		await fs.mkdir(path.dirname(buildDir), { recursive: true });
		await publishDir(staging, buildDir);
		await fs.writeFile(path.join(buildDir, 'catalog.json'), `${JSON.stringify(result.entry, null, 2)}\n`, 'utf8');

		// 4. Catalog + IDE declarations (the only Tool Project write-back).
		await this.catalog.upsertEntries(info, [result.entry]);
		await this.catalog.setCurrentBuild(info.projectLocationId, sourceHash);
		await writeDeshelfDeclarations(info.projectDir, result.entry);
		return {
			ok: true,
			fromCache: false,
			entry: result.entry,
			containerUrl: this.containerUrlFor(info.projectLocationId, sourceHash),
			diagnostics: []
		};
	}

	/** `deshelf-cache://builds/<locId>/<hash>/container.html` — real paths stay in Main. */
	containerUrlFor(projectLocationId: string, sourceHash: string): string {
		return cacheUrlFor(`builds/${projectLocationId}/${sourceHash}/container.html`);
	}

	/** Container page query parameters for one endpoint. */
	containerPageUrl(containerUrl: string, artifactsMain: string, endpoint: 'main' | 'slate'): string {
		return `${containerUrl}?entry=${encodeURIComponent(`./${artifactsMain}`)}&endpoint=${endpoint}`;
	}
}

/**
 * Publishes a staging tree with one rename. Windows can transiently EPERM directory
 * renames (AV/ indexer file locks); retry briefly, then fall back to copy+remove.
 */
async function publishDir(from: string, to: string): Promise<void> {
	for (let attempt = 0; attempt < 5; attempt++) {
		try {
			await fs.rename(from, to);
			return;
		} catch (err) {
			const code = (err as NodeJS.ErrnoException).code;
			if (code !== 'EPERM' && code !== 'EACCES' && code !== 'EBUSY') throw err;
			await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
		}
	}
	await fs.cp(from, to, { recursive: true });
	await fs.rm(from, { recursive: true, force: true });
}
