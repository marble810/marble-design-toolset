/**
 * Asset Slot descriptors: typed inputs declared in the Tool Entry `assets` map.
 */
import { error, fail, ok, type Diagnostic, type Result } from './diagnostics.ts';
import { ID_PATTERN } from './manifest.ts';

export type AssetKind = 'image' | 'video' | 'audio' | 'data';

export interface AssetSlotDescriptor {
	id: string;
	kind: AssetKind;
	label: string;
	accept?: readonly string[];
	required?: boolean;
}

export function validateAssetMap(input: unknown): Result<Record<string, AssetSlotDescriptor>> {
	if (input === null || typeof input !== 'object' || Array.isArray(input)) {
		return fail([error('asset/map', 'assets must be an object map')]);
	}
	const map = input as Record<string, unknown>;
	const diagnostics: Diagnostic[] = [];
	const out: Record<string, AssetSlotDescriptor> = {};

	const kinds: AssetKind[] = ['image', 'video', 'audio', 'data'];
	for (const key of Object.keys(map)) {
		const raw = map[key];
		if (typeof raw !== 'object' || raw === null) {
			diagnostics.push(error('asset/invalid', `asset '${key}' must be an object`, key));
			continue;
		}
		const def = raw as Record<string, unknown>;
		const local: Diagnostic[] = [];
		if (!ID_PATTERN.test(key)) local.push(error('id/invalid', `'${key}' is not a valid stable ID`, key));
		if (typeof def.kind !== 'string' || !kinds.includes(def.kind as AssetKind)) {
			local.push(error('asset/kind', `'${key}' has unknown kind`, key));
		}
		if (typeof def.label !== 'string' || def.label.length === 0) {
			local.push(error('asset/label', `'${key}' requires a label`, key));
		}
		if (def.accept !== undefined && (!Array.isArray(def.accept) || !def.accept.every((a) => typeof a === 'string'))) {
			local.push(error('asset/accept', `'${key}' accept must be string array`, key));
		}
		if (local.length > 0) {
			diagnostics.push(...local);
			continue;
		}
		out[key] = {
			id: key,
			kind: def.kind as AssetKind,
			label: def.label as string,
			...(Array.isArray(def.accept) ? { accept: def.accept as readonly string[] } : {}),
			...(typeof def.required === 'boolean' ? { required: def.required as boolean } : {})
		};
	}
	return diagnostics.length > 0 ? fail(diagnostics) : ok(out);
}
