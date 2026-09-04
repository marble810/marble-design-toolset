import { promises as fs } from 'node:fs';
import path from 'node:path';

const appRoot = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(appRoot, '../..');
const distRoot = path.join(appRoot, 'dist');

async function bundle(options: {
	entry: string;
	outfile: string;
	target: 'node' | 'browser';
	format: 'esm' | 'cjs';
	external?: string[];
}): Promise<void> {
	const result = await Bun.build({
		entrypoints: [path.resolve(appRoot, options.entry)],
		outdir: path.dirname(path.resolve(appRoot, options.outfile)),
		naming: path.basename(options.outfile),
		target: options.target,
		format: options.format,
		sourcemap: 'external',
		minify: false,
		external: options.external ?? []
	});
	if (!result.success) {
		throw new AggregateError(result.logs, `failed to bundle ${options.entry}`);
	}
}

await fs.rm(distRoot, { recursive: true, force: true });
await fs.mkdir(path.join(distRoot, 'main'), { recursive: true });
await fs.mkdir(path.join(distRoot, 'ui'), { recursive: true });
await fs.mkdir(path.join(distRoot, 'forge', 'compiled'), { recursive: true });

await bundle({
	entry: 'src/main/electron-main.ts',
	outfile: 'dist/main/electron-main.js',
	target: 'node',
	format: 'esm',
	external: ['electron', 'vite', '@sveltejs/vite-plugin-svelte', 'svelte', 'svelte/*', 'esbuild']
});
await bundle({
	entry: 'src/main/preload-host.ts',
	outfile: 'dist/main/preload-host.cjs',
	target: 'node',
	format: 'cjs',
	external: ['electron']
});
await bundle({
	entry: 'src/main/preload-container.ts',
	outfile: 'dist/main/preload-container.cjs',
	target: 'node',
	format: 'cjs',
	external: ['electron']
});
await bundle({
	entry: 'src/ui/host-ui.ts',
	outfile: 'dist/ui/host-ui.js',
	target: 'browser',
	format: 'esm'
});
await bundle({
	entry: 'src/container/bootstrap.ts',
	outfile: 'dist/forge/container-bootstrap-entry.js',
	target: 'browser',
	format: 'esm',
	external: ['svelte', 'svelte/*']
});
await bundle({
	entry: 'src/main/controlled-build-runner.ts',
	outfile: 'dist/forge/controlled-build-runner.js',
	target: 'node',
	format: 'esm',
	external: ['vite', '@sveltejs/vite-plugin-svelte', 'svelte', 'svelte/*', 'esbuild']
});

const resourceEntries = [
	{
		entry: path.join(repoRoot, 'packages/tool-sdk/src/index.ts'),
		outfile: path.join(distRoot, 'forge/compiled/tool-sdk.js'),
		target: 'browser' as const
	},
	{
		entry: path.join(repoRoot, 'packages/tool-contract/src/index.ts'),
		outfile: path.join(distRoot, 'forge/compiled/tool-contract.js'),
		target: 'browser' as const
	},
	{
		entry: path.join(repoRoot, 'packages/tool-builder/src/worker/extraction-runner.ts'),
		outfile: path.join(distRoot, 'forge/compiled/extraction-worker.js'),
		target: 'node' as const
	}
];
for (const resource of resourceEntries) {
	const result = await Bun.build({
		entrypoints: [resource.entry],
		outdir: path.dirname(resource.outfile),
		naming: path.basename(resource.outfile),
		target: resource.target,
		format: 'esm',
		minify: false,
		external: resource.target === 'browser' ? ['svelte', 'svelte/*'] : []
	});
	if (!result.success) throw new AggregateError(result.logs, `failed to bundle ${resource.entry}`);
}

const hostHtml = (await fs.readFile(path.join(appRoot, 'ui/index.html'), 'utf8')).replace(
	'../src/ui/host-ui.ts',
	'./host-ui.js'
);
await fs.writeFile(path.join(distRoot, 'ui/index.html'), hostHtml, 'utf8');
await fs.writeFile(
	path.join(distRoot, 'forge/forge-resources.json'),
	`${JSON.stringify({
		version: 1,
		profiles: {
			'forge-v1': {
				toolSdkEntry: 'compiled/tool-sdk.js',
				toolContractEntry: 'compiled/tool-contract.js',
				extractionWorkerPath: 'compiled/extraction-worker.js'
			}
		}
	}, null, 2)}\n`,
	'utf8'
);

const requiredOutputs = [
	'main/electron-main.js',
	'main/preload-host.cjs',
	'main/preload-container.cjs',
	'ui/index.html',
	'ui/host-ui.js',
	'forge/container-bootstrap-entry.js',
	'forge/controlled-build-runner.js',
	'forge/compiled/tool-sdk.js',
	'forge/compiled/tool-contract.js',
	'forge/compiled/extraction-worker.js',
	'forge/forge-resources.json'
];
for (const relative of requiredOutputs) await fs.access(path.join(distRoot, relative));

console.log(`Desktop bundles written to ${distRoot}`);
