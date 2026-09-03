/**
 * Controlled build runner entry (runs in the isolated build child process).
 *
 * Usage: <execPath> controlled-build-runner <payloadFile>
 * Writes a BuildExecutorResult JSON to `payload.resultFile` and exits 0. Any thrown
 * error becomes a failed-build result — the runner never crashes without reporting.
 * Packaged apps ship this module compiled to JS (packaging step); in development it is
 * executed directly by bun/node.
 */
import { promises as fs } from 'node:fs';
import type { ControlledBuildPayload } from './controlled-build.ts';
import { runDesktopBuildPipeline } from './controlled-build.ts';

async function main(): Promise<void> {
	const payloadFile = process.argv[2];
	if (payloadFile === undefined) {
		console.error('controlled-build-runner: missing payload file argument');
		process.exitCode = 2;
		return;
	}
	const payload = JSON.parse(await fs.readFile(payloadFile, 'utf8')) as ControlledBuildPayload;
	let result;
	try {
		result = await runDesktopBuildPipeline(payload);
	} catch (err) {
		result = {
			ok: false,
			diagnostics: [{ severity: 'error', code: 'desktop/build-crash', message: err instanceof Error ? err.message : String(err) }]
		};
	}
	await fs.writeFile(payload.resultFile, JSON.stringify(result), 'utf8');
}

void main();
