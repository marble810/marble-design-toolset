/**
 * CLI: generate the Deshelf Web static Catalog.
 *
 *   bun ./scripts/build-web-catalog.ts [--tools <dir>] [--out <dir>]
 *
 * Defaults: tools/ → static/deshelf. Exit code is 0 even when individual Tool Projects
 * fail (they are excluded from the usable Catalog and reported); the build pipeline
 * surfaces failures in its output.
 */
import path from 'node:path';
import { generateWebCatalog } from './web-catalog/generate.ts';

function parseArgs(argv: string[]): { tools: string; out: string } {
	let tools = 'tools';
	let out = path.join('static', 'deshelf');
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === '--tools' && argv[i + 1] !== undefined) {
			tools = argv[i + 1];
			i += 1;
		} else if (argv[i] === '--out' && argv[i + 1] !== undefined) {
			out = argv[i + 1];
			i += 1;
		}
	}
	return { tools, out };
}

const { tools, out } = parseArgs(process.argv.slice(2));
const result = await generateWebCatalog({
	toolsRoot: path.resolve(tools),
	outRoot: path.resolve(out),
	log: (message) => console.log(message)
});

console.log(`[forge] Web static Catalog: ${result.entries.length} usable entries → ${path.join(out, 'catalog.json')}`);
if (result.failures.length > 0) {
	console.warn(`[forge] ${result.failures.length} Tool Project(s) did NOT enter the Catalog:`);
	for (const failure of result.failures) {
		console.warn(`  - ${failure.folderName} (${failure.stage}/${failure.reason})`);
		for (const diagnostic of failure.diagnostics) {
			console.warn(`    ${diagnostic.code}: ${diagnostic.message}${diagnostic.path !== undefined ? ` @ ${diagnostic.path}` : ''}`);
		}
	}
}
