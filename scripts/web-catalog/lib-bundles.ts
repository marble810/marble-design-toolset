/**
 * Framework Library supply for the Web Tool Container. Tool artifacts are compiled with
 * Svelte (and declared Framework Libraries) left external — the container supplies them
 * at runtime through an import map pointing at pre-built ES module bundles under
 * `libs/`. One Vite library build produces all specifier entries with SHARED chunks, so
 * e.g. `svelte` and `svelte/internal/client` never instantiate the runtime twice.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { build as viteBuild, type Plugin } from 'vite';

const VIRTUAL_PREFIX = '\0deshelf-lib:';

/** The Svelte runtime is always needed by the container bootstrap (`mount`). */
export const ALWAYS_SUPPLIED_SPECIFIERS = ['svelte'] as const;

/** Extracts bare import specifiers (static + dynamic + side-effect) from ES module source. */
export function collectBareImports(source: string): string[] {
	const specifiers = new Set<string>();
	const fromPattern = /\bfrom\s*['"]([^'"]+)['"]/g;
	const dynamicPattern = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
	const sideEffectPattern = /^\s*import\s*['"]([^'"]+)['"]/gm;
	for (const match of source.matchAll(fromPattern)) specifiers.add(match[1]);
	for (const match of source.matchAll(dynamicPattern)) specifiers.add(match[1]);
	for (const match of source.matchAll(sideEffectPattern)) specifiers.add(match[1]);
	return [...specifiers].filter((spec) => !spec.startsWith('.') && !spec.startsWith('/') && !spec.startsWith('#') && !spec.startsWith('node:'));
}

/** Walks a built artifact directory and collects the union of bare specifiers. */
export async function collectArtifactImports(artifactDir: string): Promise<string[]> {
	const specifiers = new Set<string>();
	async function walk(dir: string): Promise<void> {
		for (const dirent of await fs.readdir(dir, { withFileTypes: true })) {
			const full = path.join(dir, dirent.name);
			if (dirent.isDirectory()) {
				await walk(full);
				continue;
			}
			if (dirent.name.endsWith('.js')) {
				for (const spec of collectBareImports(await fs.readFile(full, 'utf8'))) {
					specifiers.add(spec);
				}
			}
		}
	}
	await walk(artifactDir);
	return [...specifiers];
}

/** Flattens a specifier into a safe file stem (dots/slashes → `__`). */
export function specifierToStem(specifier: string): string {
	return specifier.replace(/[^a-zA-Z0-9-]/g, '__');
}

export interface BundleFrameworkLibsResult {
	/** Import map: bare specifier → URL relative to the container page (`libs/…`). */
	importMap: Record<string, string>;
	/** Bundled specifiers (for diagnostics). */
	bundled: string[];
}

export interface BundleFrameworkLibsInput {
	specifiers: readonly string[];
	outDir: string;
	/** Adds a console note per specifier when enabled. */
	log?: (message: string) => void;
}

/**
 * Builds one self-contained-per-entry ES module library bundle set. Each specifier gets
 * an entry file re-exporting its full namespace (plus an interop default), and shared
 * internals become shared chunks — one runtime instance per library graph.
 */
export async function bundleFrameworkLibs(input: BundleFrameworkLibsInput): Promise<BundleFrameworkLibsResult> {
	const unique = [...new Set(input.specifiers)];
	if (unique.length === 0) {
		return { importMap: {}, bundled: [] };
	}
	const virtualEntries: Plugin = {
		name: 'deshelf-lib-entry',
		resolveId(id) {
			if (id.startsWith(VIRTUAL_PREFIX)) return id;
			return undefined;
		},
		load(id) {
			if (!id.startsWith(VIRTUAL_PREFIX)) return undefined;
			const specifier = id.slice(VIRTUAL_PREFIX.length);
			// Interop: named exports pass through; a default import gets the module's own
			// default when present, the namespace otherwise (bundler-interop semantics).
			return [
				`import * as __deshelf_ns from ${JSON.stringify(specifier)};`,
				'export default __deshelf_ns.default !== undefined ? __deshelf_ns.default : __deshelf_ns;',
				`export * from ${JSON.stringify(specifier)};`
			].join('\n');
		}
	};

	const rollupInput: Record<string, string> = {};
	const importMap: Record<string, string> = {};
	for (const specifier of unique) {
		const stem = specifierToStem(specifier);
		rollupInput[stem] = `${VIRTUAL_PREFIX}${specifier}`;
		importMap[specifier] = `./libs/${stem}.js`;
	}

	await viteBuild({
		configFile: false,
		logLevel: 'error',
		plugins: [virtualEntries],
		build: {
			outDir: input.outDir,
			emptyOutDir: true,
			sourcemap: false,
			minify: false,
			target: 'esnext',
			rollupOptions: {
				input: rollupInput,
				// Entries are pure re-export facades; without this, Rollup tree-shakes their
				// exports away and the import map would resolve to a module without names.
				preserveEntrySignatures: 'strict',
				output: {
					format: 'es',
					entryFileNames: '[name].js',
					chunkFileNames: 'chunks/[name]-[hash].js'
				}
			}
		}
	});

	for (const specifier of unique) {
		input.log?.(`[forge] supplied Framework Library: ${specifier} → libs/${specifierToStem(specifier)}.js`);
	}
	return { importMap, bundled: unique };
}
