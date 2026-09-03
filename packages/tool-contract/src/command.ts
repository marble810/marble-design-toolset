/**
 * Tool Command descriptors: one-shot public commands. Stable ID comes from the
 * Tool Entry `commands` map key; the callback stays in the Main artifact.
 */
import { error, fail, ok, type Diagnostic, type Result } from './diagnostics.ts';
import { ID_PATTERN } from './manifest.ts';

export interface ToolCommandDescriptor {
	id: string;
	label: string;
}

export function validateCommandMap(input: unknown): Result<Record<string, ToolCommandDescriptor>> {
	if (input === null || typeof input !== 'object' || Array.isArray(input)) {
		return fail([error('command/map', 'commands must be an object map')]);
	}
	const map = input as Record<string, unknown>;
	const diagnostics: Diagnostic[] = [];
	const out: Record<string, ToolCommandDescriptor> = {};

	for (const key of Object.keys(map)) {
		const raw = map[key];
		if (typeof raw !== 'object' || raw === null) {
			diagnostics.push(error('command/invalid', `command '${key}' must be an object`, key));
			continue;
		}
		const def = raw as Record<string, unknown>;
		const local: Diagnostic[] = [];
		if (!ID_PATTERN.test(key)) local.push(error('id/invalid', `'${key}' is not a valid stable ID`, key));
		if (typeof def.label !== 'string' || def.label.length === 0) {
			local.push(error('command/label', `'${key}' requires a label`, key));
		}
		if (local.length > 0) {
			diagnostics.push(...local);
			continue;
		}
		out[key] = { id: key, label: def.label as string };
	}
	return diagnostics.length > 0 ? fail(diagnostics) : ok(out);
}
