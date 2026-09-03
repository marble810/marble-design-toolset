/**
 * Controlled Desktop build executors.
 *
 * A Desktop build runs UNTRUSTED-WORKLOAD-ADJACENT work (user Tool sources compiled by
 * vite) outside the app's interactive lifetime constraints:
 *
 * - `ControlledBuildExecutor` (production) spawns a separate build process running
 *   `controlled-build-runner` with a hard timeout; an overrunning build is killed and
 *   reported as a failed build — it can never wedge the app.
 * - `InProcessBuildExecutor` (development/tests) runs the same pipeline in-process.
 *
 * Both executors receive Forge Profile resources through the deployable resolver, never
 * through monorepo source paths. Under Electron the child runs with
 * `ELECTRON_RUN_AS_NODE=1`; the packaging step ships the runner as compiled JS (see
 * docs/for-framework-developers/desktop-adapter.md).
 */
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CatalogEntry, CatalogSourceRef, Diagnostic } from 'tool-contract';
import { buildToolProject, type ForgeProfileResources } from 'tool-builder';
import { buildContainerSupplies } from './build-supplies.ts';

export const DEFAULT_BUILD_TIMEOUT_MS = 10 * 60 * 1000;

export interface BuildExecutorInput {
	projectDir: string;
	/** Staging output directory (artifacts root for this build). */
	outDir: string;
	source: CatalogSourceRef;
	forgeProfile: ForgeProfileResources;
	/** Desktop container bootstrap entry compiled into the container page. */
	bootstrapEntry: string;
	log?: (message: string) => void;
}

export interface BuildExecutorResult {
	ok: boolean;
	diagnostics: readonly Diagnostic[];
	/** The published entry with buildDir-relative artifact paths (undefined on failure). */
	entry?: CatalogEntry;
}

export interface DesktopBuildExecutor {
	execute(input: BuildExecutorInput): Promise<BuildExecutorResult>;
}

/**
 * Rewrites builder artifact file names (relative to the artifacts outDir) into
 * buildDir-relative paths, matching the persisted Catalog shape.
 */
export function relativizeArtifacts(entry: CatalogEntry): CatalogEntry {
	const prefix = 'artifacts';
	return {
		...entry,
		artifacts: {
			main: `${prefix}/${entry.artifacts.main}`,
			...(entry.artifacts.slate !== undefined ? { slate: `${prefix}/${entry.artifacts.slate}` } : {})
		}
	};
}

/** Shared pipeline used by both executors (runner imports this for the child too). */
export async function runDesktopBuildPipeline(input: BuildExecutorInput): Promise<BuildExecutorResult> {
	const { CatalogStore } = await import('tool-builder');
	const store = new CatalogStore();
	const outcome = await buildToolProject({
		projectDir: input.projectDir,
		outDir: input.outDir,
		source: input.source,
		store,
		environment: { resolveForgeProfile: () => input.forgeProfile }
	});
	if (!outcome.ok || outcome.entry === undefined) {
		return { ok: false, diagnostics: outcome.diagnostics };
	}
	input.log?.(`[forge] built Tool Project '${outcome.entry.slug}'`);
	await buildContainerSupplies({
		stagingDir: path.dirname(input.outDir),
		artifacts: { [outcome.entry.slug]: input.outDir },
		bootstrapEntry: input.bootstrapEntry,
		log: input.log
	});
	return { ok: true, diagnostics: [], entry: relativizeArtifacts(outcome.entry) };
}

/** Development/test executor: same pipeline, in-process. */
export class InProcessBuildExecutor implements DesktopBuildExecutor {
	async execute(input: BuildExecutorInput): Promise<BuildExecutorResult> {
		return runDesktopBuildPipeline(input);
	}
}

// ---------------------------------------------------------------------------
// Production executor: isolated build child process with hard timeout
// ---------------------------------------------------------------------------

export interface ControlledBuildPayload {
	projectDir: string;
	outDir: string;
	source: CatalogSourceRef;
	forgeProfile: ForgeProfileResources;
	bootstrapEntry: string;
	/** The runner writes the BuildExecutorResult JSON here. */
	resultFile: string;
}

export interface ControlledBuildExecutorOptions {
	runnerPath?: string;
	execPath?: string;
	timeoutMs?: number;
	spawnImpl?: typeof spawn;
	env?: NodeJS.ProcessEnv;
}

export class ControlledBuildExecutor implements DesktopBuildExecutor {
	private readonly runnerPath: string;
	private readonly execPath: string;
	private readonly timeoutMs: number;
	private readonly spawnImpl: typeof spawn;
	private readonly env: NodeJS.ProcessEnv;

	constructor(options: ControlledBuildExecutorOptions = {}) {
		this.runnerPath = options.runnerPath ?? fileURLToPath(new URL('./controlled-build-runner.ts', import.meta.url));
		this.execPath = options.execPath ?? process.execPath;
		this.timeoutMs = options.timeoutMs ?? DEFAULT_BUILD_TIMEOUT_MS;
		this.spawnImpl = options.spawnImpl ?? spawn;
		this.env = options.env ?? {};
	}

	async execute(input: BuildExecutorInput): Promise<BuildExecutorResult> {
		await fs.mkdir(input.outDir, { recursive: true });
		const payload: ControlledBuildPayload = {
			projectDir: input.projectDir,
			outDir: input.outDir,
			source: input.source,
			forgeProfile: input.forgeProfile,
			bootstrapEntry: input.bootstrapEntry,
			resultFile: path.join(path.dirname(input.outDir), `build-result-${Date.now()}-${Math.random().toString(36).slice(2)}.json`)
		};
		const payloadFile = `${payload.resultFile}.payload.json`;
		await fs.writeFile(payloadFile, JSON.stringify(payload), 'utf8');

		// Under Electron, `process.execPath` is the Electron binary; ELECTRON_RUN_AS_NODE
		// turns the child into a plain Node process for building. Packaged apps ship the
		// runner as compiled JS; in development bun/node executes the TS directly.
		const env: NodeJS.ProcessEnv = {
			...process.env,
			...this.env,
			ELECTRON_RUN_AS_NODE: process.versions.electron !== undefined ? '1' : undefined
		};

		return await new Promise<BuildExecutorResult>((resolve) => {
			const child = this.spawnImpl(this.execPath, [this.runnerPath, payloadFile], {
				stdio: ['ignore', 'inherit', 'inherit'],
				windowsHide: true,
				env
			});
			let timedOut = false;
			const timer = setTimeout(() => {
				timedOut = true;
				child.kill();
			}, this.timeoutMs);
			child.on('error', (err) => {
				clearTimeout(timer);
				resolve({
					ok: false,
					diagnostics: [{ severity: 'error', code: 'desktop/build-spawn', message: `build process could not start: ${err.message}` }]
				});
			});
			child.on('close', async () => {
				clearTimeout(timer);
				if (timedOut) {
					resolve({
						ok: false,
						diagnostics: [{ severity: 'error', code: 'desktop/build-timeout', message: `build exceeded ${this.timeoutMs}ms and was terminated` }]
					});
					return;
				}
				try {
					const result = JSON.parse(await fs.readFile(payload.resultFile, 'utf8')) as BuildExecutorResult;
					resolve(result);
				} catch (err) {
					resolve({
						ok: false,
						diagnostics: [{ severity: 'error', code: 'desktop/build-result', message: `build process produced no result: ${err instanceof Error ? err.message : String(err)}` }]
					});
				} finally {
					await fs.rm(payloadFile, { force: true });
					await fs.rm(payload.resultFile, { force: true });
				}
			});
		});
	}
}
