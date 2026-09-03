/**
 * Desktop Forge Profile resources.
 *
 * The Desktop app NEVER resolves Tool builds against monorepo source paths at
 * deployment time. A deployed app ships a `forge-resources.json` manifest inside its
 * read-only resources directory:
 *
 *   {
 *     "version": 1,
 *     "profiles": {
 *       "forge-v1": {
 *         "toolSdkEntry": "compiled/tool-sdk.js",
 *         "toolContractEntry": "compiled/tool-contract.js",
 *         "extractionWorkerPath": "compiled/extraction-worker.js"
 *       }
 *     }
 *   }
 *
 * Paths resolve relative to the manifest location, pointing at COMPILED worker
 * resources produced by the packaging step. In development (this repository) the same
 * interface is served from the workspace packages, which keeps `bun test` and
 * `electron .` (dev) working without a packaging step.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { ForgeProfileResources } from 'tool-builder';

export interface ForgeResourcesFile {
	version: number;
	profiles: Record<string, ForgeProfileResources>;
}

export interface ForgeProfileResolverInput {
	/**
	 * Deployed resources root containing `forge/forge-resources.json`. When omitted
	 * (development), profiles resolve from the app's own node_modules.
	 */
	resourcesRoot?: string;
}

export class ForgeProfileNotFoundError extends Error {}

/** Development resolver: workspace packages (single-repo layout). */
export function createDevForgeProfileResolver(): (profileId: string) => Promise<ForgeProfileResources> {
	const require = createRequire(import.meta.url);
	return async (profileId) => {
		if (profileId !== 'forge-v1') {
			throw new ForgeProfileNotFoundError(`unknown Forge Profile '${profileId}'`);
		}
		// The package export map only exposes the entry; the worker is a sibling of it.
		const builderEntry = require.resolve('tool-builder');
		return {
			toolSdkEntry: require.resolve('tool-sdk'),
			toolContractEntry: require.resolve('tool-contract'),
			extractionWorkerPath: path.join(path.dirname(builderEntry), 'worker', 'extraction-runner.ts')
		};
	};
}

/** Deployment resolver: compiled resources shipped with the app. */
export function createDeployedForgeProfileResolver(
	resourcesRoot: string,
	typeofFs: typeof fs = fs
): (profileId: string) => Promise<ForgeProfileResources> {
	const manifestPath = path.join(resourcesRoot, 'forge', 'forge-resources.json');
	return async (profileId) => {
		let manifest: ForgeResourcesFile;
		try {
			manifest = JSON.parse(await typeofFs.readFile(manifestPath, 'utf8')) as ForgeResourcesFile;
		} catch (err) {
			throw new ForgeProfileNotFoundError(`forge-resources.json could not be read: ${err instanceof Error ? err.message : String(err)}`);
		}
		const profile = manifest.profiles?.[profileId];
		if (profile === undefined) throw new ForgeProfileNotFoundError(`unknown Forge Profile '${profileId}'`);
		const resolveResource = (relative: string): string => path.join(resourcesRoot, 'forge', relative);
		const resources: ForgeProfileResources = {
			toolSdkEntry: resolveResource(profile.toolSdkEntry),
			toolContractEntry: resolveResource(profile.toolContractEntry),
			extractionWorkerPath: resolveResource(profile.extractionWorkerPath)
		};
		for (const [name, target] of Object.entries(resources)) {
			try {
				await typeofFs.access(target);
			} catch {
				throw new ForgeProfileNotFoundError(`deployed Forge Profile '${profileId}' is missing ${name}: ${target}`);
			}
		}
		return resources;
	};
}
