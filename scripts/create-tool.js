import path from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';

import { collectScaffoldOptions, createToolScaffold } from './tool-scaffold/index.js';

async function main() {
	const initialName = process.argv.slice(2).join(' ').trim() || undefined;
	const rl = createInterface({
		input: process.stdin,
		output: process.stdout
	});

	try {
		console.log('Marble Design Toolset: create a new tool scaffold');
		const options = await collectScaffoldOptions({ rl, initialName });
		const result = await createToolScaffold({
			workspaceRoot: process.cwd(),
			...options
		});

		console.log(`\nCreated ${result.displayName} at ${path.relative(process.cwd(), result.toolDir)}`);
		console.log('Next steps:');
		console.log(`  1. Open src/tools/${result.toolId}/ and replace the placeholder UI.`);
		console.log('  2. Run npm run build to verify the generated tool.');
	} finally {
		rl.close();
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});