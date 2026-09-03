import type { EvaluateToolDefinitionInput } from '../src/extract.ts';
import { VALID_MANIFEST, DESKTOP_SOURCE, ARTIFACTS } from '../fixtures/manifest.ts';

/**
 * Shared helper for evaluated-definition tests. Lives outside any *.test.ts file so
 * importing it never re-runs tests (node --test executes tests from imported modules).
 */
export function inputFor(def: unknown, overrides: Partial<EvaluateToolDefinitionInput> = {}): EvaluateToolDefinitionInput {
	return {
		manifest: VALID_MANIFEST,
		definition: def as EvaluateToolDefinitionInput['definition'],
		source: DESKTOP_SOURCE,
		artifacts: ARTIFACTS,
		...overrides
	};
}