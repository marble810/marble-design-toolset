/**
 * Inspector Private Callback descriptors: Main-only callbacks referenced from the
 * Inspector Tree by stable callbackId. The actual function stays in the Main artifact.
 */
import { error, fail, ok, type Diagnostic, type Result } from './diagnostics.ts';
import { ID_PATTERN } from './manifest.ts';

export interface PrivateCallbackDescriptor {
	id: string;
}

/**
 * Validates the Catalog descriptor form of a privateCallbacks map: a plain map of
 * stable IDs to `{ id }` descriptors. The Tool Entry definition form (tagged handles
 * from defineInspectorCallback) is validated by the extraction layer.
 */
export function validatePrivateCallbackMap(input: unknown): Result<Record<string, PrivateCallbackDescriptor>> {
	if (input === null || typeof input !== 'object' || Array.isArray(input)) {
		return fail([error('private-callback/map', 'privateCallbacks must be an object map')]);
	}
	const map = input as Record<string, unknown>;
	const diagnostics: Diagnostic[] = [];
	const out: Record<string, PrivateCallbackDescriptor> = {};

	for (const key of Object.keys(map)) {
		const raw = map[key];
		if (raw === null || typeof raw !== 'object') {
			diagnostics.push(error('private-callback/invalid', `private callback '${key}' must be a descriptor`, key));
			continue;
		}
		const local: Diagnostic[] = [];
		if (!ID_PATTERN.test(key)) local.push(error('id/invalid', `'${key}' is not a valid stable ID`, key));
		if ((raw as { id?: unknown }).id !== key) {
			local.push(error('private-callback/descriptor', `'${key}' descriptor must carry id '${key}'`, key));
		}
		if (local.length > 0) {
			diagnostics.push(...local);
			continue;
		}
		out[key] = { id: key };
	}
	return diagnostics.length > 0 ? fail(diagnostics) : ok(out);
}
