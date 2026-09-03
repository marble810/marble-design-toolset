/**
 * Tool Parameter descriptors: type, mode, default and type-specific constraint.
 * The Host owns the Parameter Set; Catalog only carries these serializable descriptors.
 */
import { error, fail, ok, type Diagnostic, type Result } from './diagnostics.ts';
import { ID_PATTERN } from './manifest.ts';

export type ParameterType = 'number' | 'boolean' | 'string' | 'select';
export type ParameterMode = 'manual' | 'computed' | 'overrideable';

export type ParameterConstraint =
	| { type: 'number'; min: number; max: number; step?: number }
	| { type: 'boolean' }
	| { type: 'string'; maxLength?: number }
	| { type: 'select'; options: readonly string[] };

export interface ParameterDescriptor {
	id: string;
	type: ParameterType;
	label: string;
	default: number | boolean | string;
	mode: ParameterMode;
	constraint: ParameterConstraint;
	dependsOn?: readonly string[];
}

export function validateParameterMap(
	input: unknown,
	knownIds?: ReadonlySet<string>
): Result<Record<string, ParameterDescriptor>> {
	if (input === null || typeof input !== 'object' || Array.isArray(input)) {
		return fail([error('parameter/map', 'parameters must be an object map')]);
	}
	const map = input as Record<string, unknown>;
	const diagnostics: Diagnostic[] = [];
	const out: Record<string, ParameterDescriptor> = {};

	// computed dependsOn always references other parameters in the same flat Parameter Set.
	const ownIds = knownIds ?? new Set(Object.keys(map));

	for (const key of Object.keys(map)) {
		const raw = map[key];
		if (typeof raw !== 'object' || raw === null) {
			diagnostics.push(error('parameter/invalid', `parameter '${key}' must be an object`, key));
			continue;
		}
		const def = raw as Record<string, unknown>;
		const diags = validateParameterDefinition(key, def, ownIds);
		if (diags.length > 0) {
			diagnostics.push(...diags);
		} else {
			out[key] = {
				id: key,
				type: def.type as ParameterType,
				label: def.label as string,
				default: def.default as number | boolean | string,
				mode: def.mode as ParameterMode,
				constraint: def.constraint as ParameterConstraint,
				...(Array.isArray(def.dependsOn) ? { dependsOn: def.dependsOn as readonly string[] } : {})
			};
		}
	}

	diagnostics.push(...validateDependencyGraph(out));

	return diagnostics.length > 0 ? fail(diagnostics) : ok(out);
}

/**
 * Validates the flat computed dependency graph: duplicate entries, self-references
 * and cycles are all invalid because computed scheduling can never resolve them.
 * Cycle detection uses iterative Kahn topological sorting (no recursion).
 */
function validateDependencyGraph(params: Record<string, ParameterDescriptor>): Diagnostic[] {
	const diagnostics: Diagnostic[] = [];

	// 1. Per-parameter local checks: self-references and duplicate dependency entries.
	const nodes: string[] = [];
	const edges = new Map<string, readonly string[]>();
	for (const id of Object.keys(params)) {
		const p = params[id];
		if (p.mode !== 'computed') continue;
		nodes.push(id);
		const deps = p.dependsOn ?? [];
		const seen = new Set<string>();
		for (const dep of deps) {
			if (dep === id) {
				diagnostics.push(error('parameter/depends-on', `'${id}' must not depend on itself`, id));
			}
			if (seen.has(dep)) {
				diagnostics.push(error('parameter/depends-on', `'${id}' declares duplicate dependency '${dep}'`, id));
			}
			seen.add(dep);
		}
		if (deps.length > 0) edges.set(id, deps);
	}

	// 2. Kahn topological sort over computed-only edges. Unknown targets were already
	// reported per-definition; here we only follow edges that land on computed nodes.
	const indegree = new Map<string, number>(nodes.map((id) => [id, 0]));
	const dependents = new Map<string, string[]>(nodes.map((id) => [id, []]));
	for (const id of nodes) {
		const deps = edges.get(id) ?? [];
		for (const dep of deps) {
			if (dep !== id && params[dep]?.mode === 'computed') {
				dependents.get(dep)?.push(id);
				indegree.set(id, (indegree.get(id) ?? 0) + 1);
			}
		}
	}

	const queue = nodes.filter((id) => (indegree.get(id) ?? 0) === 0);
	let processed = 0;
	while (queue.length > 0) {
		const id = queue.shift() as string;
		processed += 1;
		for (const dependent of dependents.get(id) ?? []) {
			const next = (indegree.get(dependent) ?? 1) - 1;
			indegree.set(dependent, next);
			if (next === 0) queue.push(dependent);
		}
	}

	if (processed < nodes.length) {
		const cyclic = nodes.filter((id) => (indegree.get(id) ?? 0) > 0);
		for (const id of cyclic) {
			diagnostics.push(error('parameter/depends-on', `dependency cycle detected involving '${id}'`, id));
		}
	}

	return diagnostics;
}

function validateParameterDefinition(
	id: string,
	def: Record<string, unknown>,
	knownIds?: ReadonlySet<string>
): Diagnostic[] {
	const diagnostics: Diagnostic[] = [];

	if (!ID_PATTERN.test(id)) {
		diagnostics.push(error('id/invalid', `'${id}' is not a valid stable ID`, id));
	}

	const type = def.type;
	const validTypes: ParameterType[] = ['number', 'boolean', 'string', 'select'];
	if (typeof type !== 'string' || !validTypes.includes(type as ParameterType)) {
		diagnostics.push(error('parameter/type', `'${id}' has unknown type`, id));
		return diagnostics;
	}
	const t = type as ParameterType;

	const constraint = def.constraint as Record<string, unknown> | undefined;
	if (constraint === null || typeof constraint !== 'object' || constraint.type !== t) {
		diagnostics.push(error('parameter/constraint', `'${id}' constraint must match type '${t}'`, `${id}.constraint`));
	} else {
		const c = constraint as Record<string, unknown>;
		if (t === 'number') {
			const min = c.min as number;
			const max = c.max as number;
			if (typeof min !== 'number' || typeof max !== 'number' || !Number.isFinite(min) || !Number.isFinite(max) || min > max) {
				diagnostics.push(error('parameter/constraint', `'${id}' requires finite numeric min <= max`, `${id}.constraint`));
			}
			if (c.step !== undefined && (typeof c.step !== 'number' || !Number.isFinite(c.step) || c.step <= 0)) {
				diagnostics.push(error('parameter/constraint', `'${id}' step must be a positive finite number`, `${id}.constraint`));
			}
		} else if (t === 'select') {
			const options = c.options;
			if (!Array.isArray(options) || options.length === 0 || !options.every((o) => typeof o === 'string')) {
				diagnostics.push(error('parameter/constraint', `'${id}' select requires string options`, `${id}.constraint`));
			}
		}
	}

	const mode = def.mode;
	const validModes: ParameterMode[] = ['manual', 'computed', 'overrideable'];
	if (typeof mode !== 'string' || !validModes.includes(mode as ParameterMode)) {
		diagnostics.push(error('parameter/mode', `'${id}' has invalid mode`, id));
	} else if (mode === 'computed') {
		const deps = def.dependsOn;
		if (!Array.isArray(deps) || deps.length === 0) {
			diagnostics.push(error('parameter/mode', `'${id}' computed must declare dependsOn`, id));
		} else {
			for (const dep of deps) {
				if (knownIds !== undefined && !knownIds.has(dep)) {
					diagnostics.push(error('parameter/depends-on', `'${id}' depends on unknown '${dep}'`, id));
				}
			}
		}
	}

	const dflt = def.default;
	// constraint may be invalid/undefined here (already reported); never access it unguarded.
	const c = constraint !== null && typeof constraint === 'object' ? constraint : {};
	if (t === 'number') {
		if (typeof dflt !== 'number' || !Number.isFinite(dflt)) {
			diagnostics.push(error('parameter/default', `'${id}' default must be a finite number`, id));
		} else if (
			typeof c.min === 'number' &&
			typeof c.max === 'number' &&
			(dflt < (c.min as number) || dflt > (c.max as number))
		) {
			diagnostics.push(error('parameter/default', `'${id}' default out of range`, id));
		}
	} else if (t === 'boolean') {
		if (typeof dflt !== 'boolean') diagnostics.push(error('parameter/default', `'${id}' default must be a boolean`, id));
	} else if (t === 'select') {
		const options = (c as Record<string, unknown>).options as readonly string[] | undefined;
		if (typeof dflt !== 'string' || (options !== undefined && !options.includes(dflt))) {
			diagnostics.push(error('parameter/default', `'${id}' default must be a listed option`, id));
		}
	} else if (t === 'string') {
		if (typeof dflt !== 'string') diagnostics.push(error('parameter/default', `'${id}' default must be a string`, id));
	}

	return diagnostics;
}
