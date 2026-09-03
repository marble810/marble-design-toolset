/**
 * Desktop build supplies: the container-side runtime assets a successful Tool build
 * needs besides the compiled artifacts —
 *
 *   <buildDir>/libs/…                   Framework Library import map bundles
 *   <buildDir>/container-bootstrap.js   Desktop container bootstrap (MessagePort)
 *   <buildDir>/container.html           container chrome page (import map + bootstrap)
 *   <buildDir>/assets-<slug>/…          tool-owned Svelte styles (linked by the page)
 *
 * These come from the deployable Forge Profile, never from monorepo source paths: the
 * packaging step ships this module (bundled) plus the `tool-builder`/`vite` runtime.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { build as viteBuild } from 'vite';
import { ALWAYS_SUPPLIED_SPECIFIERS, bundleFrameworkLibs, collectArtifactImports } from '../../../../scripts/web-catalog/lib-bundles.ts';
import { renderContainerPage } from '../../../../scripts/web-catalog/container-page.ts';

export interface BuildSuppliesInput {
	stagingDir: string;
	/** Tool slug → compiled artifact directory (the builder's outDir). */
	artifacts: Record<string, string>;
	/** Desktop container bootstrap entry (TS source in dev; compiled JS when packaged). */
	bootstrapEntry: string;
	log?: (message: string) => void;
}

export interface BuildSuppliesResult {
	stylesheetUrls: string[];
	importMap: Record<string, string>;
}

async function pathExists(target: string): Promise<boolean> {
	try {
		await fs.stat(target);
		return true;
	} catch {
		return false;
	}
}

/** Builds the Desktop container bootstrap bundle (svelte supplied via import map). */
export async function buildDesktopBootstrap(outFile: string, bootstrapEntry: string, log?: (message: string) => void): Promise<void> {
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
				input: bootstrapEntry,
				external: (id) => id === 'svelte' || id.startsWith('svelte/'),
				output: {
					format: 'es',
					entryFileNames: path.basename(outFile)
				}
			}
		}
	});
	log?.('[forge] built Desktop container bootstrap bundle');
}

/**
 * Packages one successful build into a self-contained container page + library
 * supplies. Run after `buildToolProject` succeeded, inside the controlled build.
 */
export async function buildContainerSupplies(input: BuildSuppliesInput): Promise<BuildSuppliesResult> {
	const log = input.log ?? (() => {});

	// 1. Framework Library supply across ALL built tools of this build (shared chunks →
	// one runtime instance per library graph, matching the Web supply model).
	const specifiers = new Set<string>(ALWAYS_SUPPLIED_SPECIFIERS);
	for (const dir of Object.values(input.artifacts)) {
		if (await pathExists(dir)) {
			for (const specifier of await collectArtifactImports(dir)) specifiers.add(specifier);
		}
	}
	const { importMap } = await bundleFrameworkLibs({ specifiers: [...specifiers], outDir: path.join(input.stagingDir, 'libs'), log });

	// 2. Container bootstrap bundle.
	await buildDesktopBootstrap(path.join(input.stagingDir, 'container-bootstrap.js'), input.bootstrapEntry, log);

	// 3. Tool-owned Svelte stylesheet assets; the container page links them (Svelte
	// scope hashes prevent cross-tool leakage).
	const stylesheetUrls: string[] = [];
	for (const slug of Object.keys(input.artifacts)) {
		const assetsDir = path.join(input.artifacts[slug] as string, 'assets');
		if (!(await pathExists(assetsDir))) continue;
		for (const dirent of await fs.readdir(assetsDir, { withFileTypes: true })) {
			if (dirent.isFile() && dirent.name.endsWith('.css')) {
				stylesheetUrls.push(`./artifacts/assets/${dirent.name}`);
			}
		}
	}

	// 4. Container chrome page.
	await fs.writeFile(
		path.join(input.stagingDir, 'container.html'),
		renderContainerPage({ importMap, bootstrapUrl: './container-bootstrap.js', stylesheetUrls }),
		'utf8'
	);
	return { stylesheetUrls, importMap };
}
