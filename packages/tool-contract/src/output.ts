/**
 * Visual Output descriptors: declared in the Tool Entry `outputs` map with stable IDs.
 * The render/encode callback stays in the Main artifact; the Canvas never registers an
 * exporter at runtime.
 */
import { error, fail, ok, type Diagnostic, type Result } from './diagnostics.ts';
import { ID_PATTERN } from './manifest.ts';

export type OutputKind = 'image' | 'video';

export interface VisualOutputDescriptor {
	id: string;
	kind: OutputKind;
	label: string;
	mime: string;
	width?: number;
	height?: number;
}

export function validateOutputMap(input: unknown): Result<Record<string, VisualOutputDescriptor>> {
	if (input === null || typeof input !== 'object' || Array.isArray(input)) {
		return fail([error('output/map', 'outputs must be an object map')]);
	}
	const map = input as Record<string, unknown>;
	const diagnostics: Diagnostic[] = [];
	const out: Record<string, VisualOutputDescriptor> = {};

	const kinds: OutputKind[] = ['image', 'video'];
	for (const key of Object.keys(map)) {
		const raw = map[key];
		if (typeof raw !== 'object' || raw === null) {
			diagnostics.push(error('output/invalid', `output '${key}' must be an object`, key));
			continue;
		}
		const def = raw as Record<string, unknown>;
		const local: Diagnostic[] = [];
		if (!ID_PATTERN.test(key)) local.push(error('id/invalid', `'${key}' is not a valid stable ID`, key));
		if (typeof def.kind !== 'string' || !kinds.includes(def.kind as OutputKind)) {
			local.push(error('output/kind', `'${key}' has unknown kind`, key));
		}
		if (typeof def.label !== 'string' || def.label.length === 0) {
			local.push(error('output/label', `'${key}' requires a label`, key));
		}
		if (typeof def.mime !== 'string' || def.mime.length === 0) {
			local.push(error('output/mime', `'${key}' requires a mime type`, key));
		}
		if (
			def.width !== undefined &&
			(typeof def.width !== 'number' || !Number.isFinite(def.width) || def.width <= 0)
		) {
			local.push(error('output/dimension', `'${key}' width must be a positive finite number`, key));
		}
		if (
			def.height !== undefined &&
			(typeof def.height !== 'number' || !Number.isFinite(def.height) || def.height <= 0)
		) {
			local.push(error('output/dimension', `'${key}' height must be a positive finite number`, key));
		}
		if (local.length > 0) {
			diagnostics.push(...local);
			continue;
		}
		out[key] = {
			id: key,
			kind: def.kind as OutputKind,
			label: def.label as string,
			mime: def.mime as string,
			...(typeof def.width === 'number' ? { width: def.width as number } : {}),
			...(typeof def.height === 'number' ? { height: def.height as number } : {})
		};
	}
	return diagnostics.length > 0 ? fail(diagnostics) : ok(out);
}
