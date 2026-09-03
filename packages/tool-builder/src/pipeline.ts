/**
 * Public Deshelf Forge build pipeline (owned by tool-builder): reads a Tool Project
 * on disk (manifest.json + fixed index.ts), compiles the Tool Entry and Canvas/Slate
 * with Forge-owned Vite/Svelte configuration, evaluates extraction inside a terminable
 * worker process with a timeout, validates, and only then publishes the Catalog Entry.
 *
 * The caller supplies a project directory and an output directory — never an
 * already-evaluated definition and never arbitrary artifact paths.
 */
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as viteBuild, type InlineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { error, validateManifest, type CatalogEntry, type CatalogSourceRef, type Diagnostic } from 'tool-contract';
import type { CatalogStore } from './catalog-store.ts';
import type { EvaluateToolDefinitionInput } from './extract.ts';

export const DEFAULT_EXTRACTION_TIMEOUT_MS = 10_000;

export interface ForgeProfileResources {
	toolSdkEntry: string;
	toolContractEntry: string;
	extractionWorkerPath: string;
}

export interface ToolBuilderEnvironment {
	resolveForgeProfile(profileId: string): ForgeProfileResources | Promise<ForgeProfileResources>;
}

export interface BuildToolProjectInput {
	projectDir: string;
	outDir: string;
	source: CatalogSourceRef;
	store: CatalogStore;
	environment?: ToolBuilderEnvironment;
	/** Extraction evaluation timeout; the worker process is terminated when exceeded. */
	extractionTimeoutMs?: number;
}

export interface BuildToolProjectOutcome {
	ok: boolean;
	diagnostics: readonly Diagnostic[];
	entry?: CatalogEntry;
}

const require = createRequire(import.meta.url);

export const DEFAULT_TOOL_BUILDER_ENVIRONMENT: ToolBuilderEnvironment = {
	resolveForgeProfile() {
		return {
			toolSdkEntry: require.resolve('tool-sdk'),
			toolContractEntry: require.resolve('tool-contract'),
			extractionWorkerPath: fileURLToPath(new URL('./worker/extraction-runner.ts', import.meta.url))
		};
	}
};

function normalizeId(id: string): string {
	return path.normalize(id).replace(/\\/g, '/');
}

function isSameOrInside(parent: string, candidate: string): boolean {
	const relative = path.relative(parent, candidate);
	return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function resolvePhysicalPath(candidate: string): Promise<string> {
	const missingSegments: string[] = [];
	let cursor = candidate;
	while (true) {
		try {
			const existing = await fs.realpath(cursor);
			return path.join(existing, ...missingSegments);
		} catch (err) {
			const code = (err as NodeJS.ErrnoException).code;
			if (code !== 'ENOENT' && code !== 'ENOTDIR') throw err;
			const parent = path.dirname(cursor);
			if (parent === cursor) throw err;
			missingSegments.unshift(path.basename(cursor));
			cursor = parent;
		}
	}
}

/** Structural view of a compiled chunk; avoids depending on Rollup/Rolldown types. */
interface BuiltChunk {
	type: string;
	fileName: string;
	isEntry?: boolean;
	isDynamicEntry?: boolean;
	facadeModuleId?: string | null;
}

interface BuiltOutput {
	output: readonly BuiltChunk[];
}

/**
 * What the extraction worker receives: the evaluated-step input minus the definition
 * (which the worker loads from the compiled artifact), plus the artifact entry path.
 */
type WorkerPayload = Omit<EvaluateToolDefinitionInput, 'definition'> & { entryPath: string };

function runWorker(workerPath: string, payload: WorkerPayload, timeoutMs: number): Promise<{ outcome?: { ok: boolean; diagnostics: unknown; entry?: unknown }; timedOut: boolean; stderr: string }> {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [workerPath, JSON.stringify(payload)], {
			stdio: ['ignore', 'pipe', 'pipe'],
			windowsHide: true
		});
		let stdout = '';
		let stderr = '';
		let timedOut = false;
		child.stdout.on('data', (d: Buffer) => {
			stdout += d.toString();
		});
		child.stderr.on('data', (d: Buffer) => {
			stderr += d.toString();
		});
		child.on('error', (err) => {
			reject(err);
		});
		const timer = setTimeout(() => {
			timedOut = true;
			child.kill();
		}, timeoutMs);
		child.on('close', () => {
			clearTimeout(timer);
			if (timedOut) {
				resolve({ timedOut, stderr });
				return;
			}
			const lastLine = stdout.trim().split(/\r?\n/).pop() ?? '';
			try {
				const outcome = JSON.parse(lastLine) as { ok: boolean; diagnostics: unknown; entry?: unknown };
				resolve({ outcome, timedOut: false, stderr });
			} catch {
				resolve({ timedOut: false, stderr: `${stderr}\n${stdout}`.slice(0, 2000) });
			}
		});
	});
}

export async function buildToolProject(input: BuildToolProjectInput): Promise<BuildToolProjectOutcome> {
	const timeoutMs = input.extractionTimeoutMs ?? DEFAULT_EXTRACTION_TIMEOUT_MS;
	const projectDir = path.resolve(input.projectDir);
	const outDir = path.resolve(input.outDir);
	const manifestPath = path.join(projectDir, 'manifest.json');
	const entryPath = path.join(projectDir, 'index.ts');

	let physicalProjectDir: string;
	let physicalOutDir: string;
	try {
		[physicalProjectDir, physicalOutDir] = await Promise.all([
			resolvePhysicalPath(projectDir),
			resolvePhysicalPath(outDir)
		]);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { ok: false, diagnostics: [error('build/path-resolution', `Builder paths could not be resolved: ${message}`)] };
	}
	if (
		isSameOrInside(physicalProjectDir, physicalOutDir) ||
		isSameOrInside(physicalOutDir, physicalProjectDir)
	) {
		return {
			ok: false,
			diagnostics: [error('build/output-overlap', 'outDir must not equal, contain, or resolve into the Tool Project directory')]
		};
	}

	// 1. Read + parse the Manifest. A broken Manifest never starts a build.
	let rawManifest: unknown;
	try {
		rawManifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { ok: false, diagnostics: [error('build/manifest-read', `manifest.json could not be read: ${message}`)] };
	}
	const manifest = validateManifest(rawManifest);
	if (!manifest.ok) return { ok: false, diagnostics: manifest.diagnostics };

	// 2. The fixed Tool Entry must exist at the project root.
	try {
		const stat = await fs.stat(entryPath);
		if (!stat.isFile()) throw new Error('index.ts is not a file');
	} catch {
		return { ok: false, diagnostics: [error('build/entry-missing', "fixed Tool Entry 'index.ts' is missing")] };
	}

	// 3. Resolve Forge-owned resources, then compile the Tool Entry + Canvas/Slate.
	let resources: ForgeProfileResources;
	try {
		resources = await (input.environment ?? DEFAULT_TOOL_BUILDER_ENVIRONMENT).resolveForgeProfile(
			manifest.value.forgeProfile
		);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { ok: false, diagnostics: [error('build/forge-profile', `Forge Profile could not be resolved: ${message}`)] };
	}

	let rollupOutput: BuiltOutput;
	try {
		const config: InlineConfig = {
			configFile: false,
			root: projectDir,
			logLevel: 'error',
			plugins: [svelte({ compilerOptions: { dev: false } })],
			resolve: {
				alias: [
					{ find: '@deshelf/tool-sdk', replacement: resources.toolSdkEntry },
					{ find: '@deshelf/tool-contract', replacement: resources.toolContractEntry }
				]
			},
			build: {
				outDir,
				emptyOutDir: true,
				sourcemap: false,
				minify: false,
				target: 'esnext',
				// Library-style entry so the Tool Entry default export survives compilation.
				lib: {
					entry: entryPath,
					formats: ['es'],
					fileName: () => 'main.js'
				},
				rollupOptions: {
					// The Svelte runtime is a Forge-supplied Framework Library resolved inside
					// the Tool Container; Tool Projects never bundle their own copy.
					external: (id) => id === 'svelte' || id.startsWith('svelte/'),
					output: {
						format: 'es',
						chunkFileNames: 'chunks/[name]-[hash].js',
						assetFileNames: 'assets/[name]-[hash][extname]'
					}
				}
			}
		};
		const built = await viteBuild(config);
		rollupOutput = (Array.isArray(built) ? built[0] : built) as BuiltOutput;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { ok: false, diagnostics: [error('build/compile', `Tool Entry compilation failed: ${message}`.slice(0, 4000))] };
	}

	// 4. Derive artifact names from the build result (never from caller input).
	const chunks = rollupOutput.output.filter(
		(o): o is BuiltChunk & { type: 'chunk' } => o.type === 'chunk'
	);
	const mainChunk = chunks.find(
		(c) =>
			c.isEntry &&
			c.facadeModuleId !== undefined &&
			c.facadeModuleId !== null &&
			normalizeId(c.facadeModuleId) === normalizeId(entryPath)
	);
	if (mainChunk === undefined) {
		return { ok: false, diagnostics: [error('build/main-chunk', 'compiled output did not contain the main Tool Entry chunk')] };
	}
	// Forge convention: an optional Tool Slate lives under <project>/slate/Slate.svelte.
	const slateChunk = chunks.find(
		(c) =>
			c.isDynamicEntry &&
			c.facadeModuleId !== undefined &&
			c.facadeModuleId !== null &&
			normalizeId(c.facadeModuleId).endsWith('/slate/Slate.svelte')
	);
	const artifacts = {
		main: mainChunk.fileName,
		...(slateChunk !== undefined ? { slate: slateChunk.fileName } : {})
	};

	// 5. Evaluate extraction in a terminable worker process with a timeout. The worker
	// imports the compiled entry (never executes Canvas/GPU), runs descriptor-only
	// createInspector, and returns a plain JSON outcome.
	const workerPath = resources.extractionWorkerPath;
	const payload: WorkerPayload = {
		manifest: manifest.value,
		source: input.source,
		artifacts,
		entryPath: path.join(outDir, mainChunk.fileName)
	};

	let workerResult: Awaited<ReturnType<typeof runWorker>>;
	try {
		workerResult = await runWorker(workerPath, payload, timeoutMs);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { ok: false, diagnostics: [error('build/worker', `extraction worker could not start: ${message}`)] };
	}

	if (workerResult.timedOut) {
		return {
			ok: false,
			diagnostics: [error('extraction/timeout', `extraction exceeded ${timeoutMs}ms and was terminated`)]
		};
	}
	if (workerResult.outcome === undefined) {
		return { ok: false, diagnostics: [error('build/worker', `extraction worker produced no result: ${workerResult.stderr}`)] };
	}

	const outcome = workerResult.outcome as { ok: boolean; diagnostics: readonly Diagnostic[]; entry?: CatalogEntry };
	if (!outcome.ok) return { ok: false, diagnostics: outcome.diagnostics };
	if (outcome.entry === undefined) {
		return { ok: false, diagnostics: [error('build/worker', 'extraction worker returned ok without an entry')] };
	}

	// 6. Only a fully validated entry is published into the usable Catalog.
	input.store.upsert(outcome.entry);
	return { ok: true, diagnostics: [], entry: outcome.entry };
}