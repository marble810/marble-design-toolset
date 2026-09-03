/**
 * Extraction worker: executed as a child process by the Forge pipeline. Imports the
 * compiled Tool Entry artifact, runs the descriptor-only evaluation step with
 * createInspector, and prints one JSON line with the outcome. The parent process owns
 * the timeout and terminates this process when extraction hangs.
 */
import { pathToFileURL } from 'node:url';
import { error } from 'tool-contract';
import { evaluateToolDefinition, type EvaluateToolDefinitionInput } from '../extract.ts';

interface Payload {
	manifest: unknown;
	source: unknown;
	artifacts: { main: string; slate?: string };
	entryPath: string;
}

const payload = JSON.parse(process.argv[2] ?? '') as Payload;

async function main(): Promise<void> {
	try {
		const module = (await import(pathToFileURL(payload.entryPath).href)) as { default?: unknown };
		const definition = module.default;
		if (definition === null || typeof definition !== 'object') {
			throw new Error('Tool Entry must default-export a defineVisualTool definition');
		}
		const input: EvaluateToolDefinitionInput = {
			manifest: payload.manifest,
			definition: definition as EvaluateToolDefinitionInput['definition'],
			source: payload.source as EvaluateToolDefinitionInput['source'],
			artifacts: payload.artifacts
		};
		const outcome = evaluateToolDefinition(input);
		process.stdout.write(JSON.stringify(outcome));
		process.exit(outcome.ok ? 0 : 1);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		process.stdout.write(
			JSON.stringify({ ok: false, diagnostics: [error('extraction/entry', `Tool Entry evaluation failed: ${message}`)] })
		);
		process.exit(1);
	}
}

void main();