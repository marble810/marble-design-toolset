/**
 * INTERNAL evaluated-definition extraction step: turns an already-evaluated Tool Entry
 * definition plus its Manifest into a deterministic, serializable Catalog Entry.
 *
 * This module is deliberately NOT the public build pipeline. The public pipeline
 * (pipeline.ts) compiles a Tool Project on disk, evaluates extraction inside a
 * terminable worker process and invokes this step there; direct tests additionally
 * exercise it with in-memory definitions and fixtures.
 *
 * Runs `createInspector` against the descriptor-only SDK (no Svelte, no GPU, no Host
 * DOM), validates every stable ID / binding / Main-only callback contract, and never
 * produces an Entry from a failed evaluation.
 */
import {
	ID_PATTERN,
	catalogEntryId,
	error,
	validateAssetMap,
	validateCatalogEntry,
	validateCommandMap,
	validateManifest,
	validateOutputMap,
	validateParameterMap,
	type CatalogEntry,
	type CatalogSourceRef,
	type Diagnostic,
	type ParameterDescriptor
} from 'tool-contract';
import {
	collectInspectorElements,
	createInspectorContext,
	type VisualToolDefinition
} from 'tool-sdk';
import type { InspectorElement } from 'tool-contract';

export interface EvaluateToolDefinitionInput {
	manifest: unknown;
	definition: VisualToolDefinition;
	source: CatalogSourceRef;
	artifacts: { main: string; slate?: string };
}

export interface EvaluateToolDefinitionOutcome {
	ok: boolean;
	diagnostics: readonly Diagnostic[];
	entry?: CatalogEntry;
}

/** Checks stable-ID validity and cross-map uniqueness across the whole definition. */
function checkNamespace(
	namespace: string,
	map: Readonly<Record<string, unknown>> | undefined,
	seen: Map<string, string>,
	diagnostics: Diagnostic[],
	extra?: (key: string, raw: unknown) => readonly Diagnostic[]
): void {
	if (map === undefined || map === null) return;
	for (const key of Object.keys(map)) {
		if (!ID_PATTERN.test(key)) {
			diagnostics.push(error('id/invalid', `'${key}' in ${namespace} is not a valid stable ID`, key));
		}
		const owner = seen.get(key);
		if (owner !== undefined) {
			diagnostics.push(error('id/duplicate', `stable ID '${key}' is used by both ${owner} and ${namespace}`, key));
		} else {
			seen.set(key, namespace);
		}
		if (extra !== undefined) diagnostics.push(...extra(key, map[key]));
	}
}

/**
 * Main-only callback contracts validated at evaluation time (the Catalog only ever
 * carries serializable descriptors, never these functions).
 */
function checkMainCallbacks(definition: VisualToolDefinition): Diagnostic[] {
	const diagnostics: Diagnostic[] = [];

	for (const key of Object.keys(definition.privateCallbacks ?? {})) {
		const raw = (definition.privateCallbacks as Record<string, unknown>)[key];
		if (raw === null || typeof raw !== 'object') {
			diagnostics.push(error('private-callback/invalid', `'${key}' must be created by defineInspectorCallback`, key));
			continue;
		}
		const value = raw as { __deshelfCallbackTag?: unknown; run?: unknown };
		if (value.__deshelfCallbackTag !== 'inspector-callback' || typeof value.run !== 'function') {
			diagnostics.push(
				error('private-callback/invalid', `'${key}' must be created by defineInspectorCallback with a run implementation`, key)
			);
		}
	}

	for (const key of Object.keys(definition.commands ?? {})) {
		const value = (definition.commands as Record<string, { run?: unknown }>)[key];
		if (value === null || typeof value !== 'object' || typeof value.run !== 'function') {
			diagnostics.push(error('command/run', `'${key}' must declare a run implementation`, key));
		}
	}

	for (const key of Object.keys(definition.outputs ?? {})) {
		const value = (definition.outputs as Record<string, { render?: unknown }>)[key];
		if (value === null || typeof value !== 'object' || typeof value.render !== 'function') {
			diagnostics.push(error('output/render', `'${key}' must declare a Main-only render implementation`, key));
		}
	}

	for (const key of Object.keys(definition.parameters ?? {})) {
		const value = (definition.parameters as Record<string, { mode?: unknown; compute?: unknown }>)[key];
		if (value !== null && typeof value === 'object' && value.mode === 'computed' && typeof value.compute !== 'function') {
			diagnostics.push(error('parameter/compute', `'${key}' is computed and must declare a compute implementation`, key));
		}
	}

	return diagnostics;
}

function dedupe(diagnostics: readonly Diagnostic[]): Diagnostic[] {
	const seen = new Set<string>();
	const out: Diagnostic[] = [];
	for (const d of diagnostics) {
		const key = `${d.code}|${d.path ?? ''}`;
		if (!seen.has(key)) {
			seen.add(key);
			out.push(d);
		}
	}
	return out;
}

function sortMap<T>(map: Record<string, T>): Record<string, T> {
	return Object.fromEntries(Object.entries(map).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

function createDefaultInspectorElements(
	parameters: Readonly<Record<string, ParameterDescriptor>>
): readonly InspectorElement[] {
	return Object.keys(parameters)
		.sort()
		.map((id): InspectorElement => {
			const parameter = parameters[id];
			const binding = { kind: 'parameter' as const, parameterId: id };
			if (parameter.type === 'number') {
				return { kind: 'slider', id, label: parameter.label, binding };
			}
			if (parameter.type === 'boolean') {
				return { kind: 'toggle', id, label: parameter.label, binding };
			}
			if (parameter.type === 'select') {
				return { kind: 'select', id, label: parameter.label, binding };
			}
			return { kind: 'text', id, label: parameter.label, binding };
		});
}

export function evaluateToolDefinition(input: EvaluateToolDefinitionInput): EvaluateToolDefinitionOutcome {
	let diagnostics: Diagnostic[] = [];

	// 1. Manifest validation first; a broken Manifest never becomes a Catalog Entry.
	const manifest = validateManifest(input.manifest);
	if (!manifest.ok) return { ok: false, diagnostics: manifest.diagnostics };

	// 2. Definition shape.
	const d = input.definition;
	if (
		d === null ||
		typeof d !== 'object' ||
		typeof d.canvas !== 'function' ||
		(d.createInspector !== undefined && typeof d.createInspector !== 'function')
	) {
		return {
			ok: false,
			diagnostics: [error('extract/definition', 'definition must expose canvas and an optional createInspector function')]
		};
	}

	// 3. Stable-ID namespace: every map key is a stable ID, unique across all five maps.
	const seen = new Map<string, string>();
	checkNamespace('parameters', d.parameters, seen, diagnostics);
	checkNamespace('assets', d.assets, seen, diagnostics);
	checkNamespace('commands', d.commands, seen, diagnostics);
	checkNamespace('privateCallbacks', d.privateCallbacks, seen, diagnostics);
	checkNamespace('outputs', d.outputs, seen, diagnostics);

	// 4. Main-only callback contracts stay in the Main artifact/definition.
	diagnostics.push(...checkMainCallbacks(d));

	// 5. Descriptor maps through the contract validators (ids come from map keys).
	const parameters = validateParameterMap(d.parameters);
	if (!parameters.ok) diagnostics.push(...parameters.diagnostics);
	const assets = validateAssetMap(d.assets ?? {});
	if (!assets.ok) diagnostics.push(...assets.diagnostics);
	const commands = validateCommandMap(d.commands ?? {});
	if (!commands.ok) diagnostics.push(...commands.diagnostics);
	const outputs = validateOutputMap(d.outputs ?? {});
	if (!outputs.ok) diagnostics.push(...outputs.diagnostics);

	const privateCallbacks: Record<string, { id: string }> = {};
	for (const key of Object.keys(d.privateCallbacks ?? {})) {
		privateCallbacks[key] = { id: key };
	}

	// 6. Execute createInspector against the descriptor-only SDK. A throw (e.g. an
	// inline anonymous callback) is an evaluation failure with diagnostics.
	let elements: readonly InspectorElement[] = [];
	try {
		if (d.createInspector === undefined) {
			elements = createDefaultInspectorElements(parameters.ok ? parameters.value : {});
		} else {
			const ctx = createInspectorContext({
				parameters: d.parameters,
				assets: d.assets,
				commands: d.commands,
				privateCallbacks: d.privateCallbacks
			});
			d.createInspector(ctx);
			elements = collectInspectorElements(ctx);
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			ok: false,
			diagnostics: dedupe([...diagnostics, error('inspector/extraction-failed', `createInspector failed: ${message}`)])
		};
	}

	diagnostics = dedupe(diagnostics);

	if (diagnostics.length > 0) return { ok: false, diagnostics };

	// 7. Assemble the Entry deterministically: sorted maps, stable identity, no timestamps.
	const entry: CatalogEntry = {
		catalogEntryId: catalogEntryId(input.source, manifest.value.projectId),
		source: input.source,
		projectId: manifest.value.projectId,
		slug: manifest.value.slug,
		name: manifest.value.name,
		...(manifest.value.description !== undefined ? { description: manifest.value.description } : {}),
		...(manifest.value.tags !== undefined ? { tags: manifest.value.tags } : {}),
		version: manifest.value.version,
		forgeProfile: manifest.value.forgeProfile,
		libraries: [...manifest.value.libraries],
		artifacts: {
			main: input.artifacts.main,
			...(typeof input.artifacts.slate === 'string' ? { slate: input.artifacts.slate } : {})
		},
		parameters: sortMap(parameters.ok ? parameters.value : {}),
		assets: sortMap(assets.ok ? assets.value : {}),
		commands: sortMap(commands.ok ? commands.value : {}),
		privateCallbacks: sortMap(privateCallbacks),
		outputs: sortMap(outputs.ok ? outputs.value : {}),
		inspectorTree: { elements },
		surfaces: { canvas: true, slate: typeof input.artifacts.slate === 'string' }
	};

	// 8. Full Catalog Entry validation (serializability, bindings, surfaces, identity).
	const validated = validateCatalogEntry(entry);
	if (!validated.ok) return { ok: false, diagnostics: validated.diagnostics };
	return { ok: true, diagnostics: [], entry: validated.value };
}