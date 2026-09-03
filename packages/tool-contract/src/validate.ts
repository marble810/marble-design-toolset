/**
 * Aggregate Catalog Entry validation: component validators + cross-map ID uniqueness,
 * inspector binding resolution, surface/artifact agreement and deep serializability.
 *
 * This module is total: arbitrary unknown input must produce diagnostics, never a throw.
 * CatalogSourceRef is validated before catalogEntryId is ever derived.
 */
import { error, fail, ok, type Diagnostic, type Result } from './diagnostics.ts';
import { validateAssetMap } from './asset.ts';
import { catalogEntryId, type CatalogEntry, type CatalogSourceRef } from './catalog.ts';
import { validateCommandMap } from './command.ts';
import { validateInspectorTree } from './inspector.ts';
import { SEMVER_PATTERN, SLUG_PATTERN, SUPPORTED_LIBRARIES } from './manifest.ts';
import { validateOutputMap } from './output.ts';
import { validateParameterMap } from './parameter.ts';
import { validatePrivateCallbackMap } from './private-callback.ts';
import { assertSerializable } from './serializable.ts';

/** Safe Catalog Source validation; never throws on arbitrary input. */
export function validateCatalogSourceRef(input: unknown): Result<CatalogSourceRef> {
	if (input === null || typeof input !== 'object' || Array.isArray(input)) {
		return fail([error('catalog/source', 'source must be a CatalogSourceRef object')]);
	}
	const s = input as Record<string, unknown>;
	if (s.kind === 'web') {
		if (typeof s.sourceId === 'string' && s.sourceId.length > 0) {
			return ok({ kind: 'web', sourceId: s.sourceId });
		}
		return fail([error('catalog/source', "web source requires a non-empty 'sourceId'", 'source.sourceId')]);
	}
	if (s.kind === 'desktop') {
		if (typeof s.projectLocationId === 'string' && s.projectLocationId.length > 0) {
			return ok({ kind: 'desktop', projectLocationId: s.projectLocationId });
		}
		return fail([
			error('catalog/source', "desktop source requires a non-empty 'projectLocationId'", 'source.projectLocationId')
		]);
	}
	return fail([error('catalog/source', "source.kind must be 'web' or 'desktop'", 'source.kind')]);
}

function nonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0;
}

export function validateCatalogEntry(entry: unknown): Result<CatalogEntry> {
	if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
		return fail([error('catalog/invalid', 'Catalog Entry must be an object')]);
	}
	const e = entry as Record<string, unknown>;
	const diagnostics: Diagnostic[] = [];

	// 1. serializability first: no functions/DOM/Svelte/library objects, no undefined
	// object properties, no NaN/Infinity anywhere.
	diagnostics.push(...assertSerializable(e));

	// 2. source first: identity must never be derived from an unvalidated source.
	const source = validateCatalogSourceRef(e.source);
	if (!source.ok) diagnostics.push(...source.diagnostics);

	// 3. required identity + metadata fields (total checks; never index unguarded).
	if (!nonEmptyString(e.projectId)) {
		diagnostics.push(error('catalog/field', 'catalogEntry requires a non-empty projectId', 'projectId'));
	}
	if (!nonEmptyString(e.catalogEntryId)) {
		diagnostics.push(error('catalog/field', 'catalogEntry requires a non-empty catalogEntryId', 'catalogEntryId'));
	} else if (source.ok && nonEmptyString(e.projectId) && e.catalogEntryId !== catalogEntryId(source.value, e.projectId)) {
		diagnostics.push(error('catalog/identity', 'catalogEntryId must equal catalogEntryId(source, projectId)', 'catalogEntryId'));
	}
	if (typeof e.slug !== 'string' || !SLUG_PATTERN.test(e.slug)) {
		diagnostics.push(error('catalog/field', 'slug must match kebab-case', 'slug'));
	}
	if (!nonEmptyString(e.name)) {
		diagnostics.push(error('catalog/field', 'catalogEntry requires a non-empty name', 'name'));
	}
	if (typeof e.version !== 'string' || !SEMVER_PATTERN.test(e.version)) {
		diagnostics.push(error('catalog/field', 'version must be semver (major.minor.patch)', 'version'));
	}
	if (!nonEmptyString(e.forgeProfile)) {
		diagnostics.push(error('catalog/field', 'catalogEntry requires a forgeProfile', 'forgeProfile'));
	}
	if (e.description !== undefined && typeof e.description !== 'string') {
		diagnostics.push(error('catalog/field', 'description must be a string when present', 'description'));
	}
	if (e.tags !== undefined && (!Array.isArray(e.tags) || !e.tags.every((t) => typeof t === 'string'))) {
		diagnostics.push(error('catalog/field', 'tags must be an array of strings when present', 'tags'));
	}
	const libraries = e.libraries;
	if (!Array.isArray(libraries) || !libraries.every((l) => typeof l === 'string' && (SUPPORTED_LIBRARIES as readonly string[]).includes(l))) {
		diagnostics.push(error('catalog/libraries', 'libraries must list only supported Framework Library ids', 'libraries'));
	}

	// 4. artifacts/surfaces.
	const artifacts = e.artifacts;
	if (artifacts === null || typeof artifacts !== 'object' || Array.isArray(artifacts)) {
		diagnostics.push(error('catalog/artifact', 'artifacts must be an object', 'artifacts'));
	} else {
		const a = artifacts as Record<string, unknown>;
		if (!nonEmptyString(a.main)) {
			diagnostics.push(error('catalog/artifact', 'artifacts.main is required', 'artifacts.main'));
		}
		if (a.slate !== undefined && !nonEmptyString(a.slate)) {
			diagnostics.push(error('catalog/artifact', 'artifacts.slate must be a non-empty string when present', 'artifacts.slate'));
		}
	}

	const surfaces = e.surfaces;
	if (surfaces === null || typeof surfaces !== 'object' || Array.isArray(surfaces)) {
		diagnostics.push(error('catalog/surface', 'surfaces must be an object', 'surfaces'));
	} else {
		const s = surfaces as Record<string, unknown>;
		if (s.canvas !== true) {
			diagnostics.push(error('catalog/surface', 'surfaces.canvas must be true', 'surfaces.canvas'));
		}
		if (typeof s.slate !== 'boolean') {
			diagnostics.push(error('catalog/surface', 'surfaces.slate must be a boolean', 'surfaces.slate'));
		}
		const artifactsObj = artifacts as Record<string, unknown> | null | undefined;
		const slateDeclared = artifactsObj !== null && typeof artifactsObj === 'object' && typeof artifactsObj.slate === 'string';
		if (typeof s.slate === 'boolean' && s.slate !== slateDeclared) {
			diagnostics.push(
				error(
					'catalog/surface-mismatch',
					'surfaces.slate must agree with the presence of artifacts.slate',
					'surfaces.slate'
				)
			);
		}
	}

	// 5. component maps.
	const parameters = validateParameterMap(e.parameters);
	if (!parameters.ok) diagnostics.push(...parameters.diagnostics);
	const assets = validateAssetMap(e.assets);
	if (!assets.ok) diagnostics.push(...assets.diagnostics);
	const commands = validateCommandMap(e.commands);
	if (!commands.ok) diagnostics.push(...commands.diagnostics);
	const privateCallbacks = validatePrivateCallbackMap(e.privateCallbacks);
	if (!privateCallbacks.ok) diagnostics.push(...privateCallbacks.diagnostics);
	const outputs = validateOutputMap(e.outputs);
	if (!outputs.ok) diagnostics.push(...outputs.diagnostics);

	// 6. cross-map ID uniqueness (stable IDs are a single namespace).
	if (parameters.ok && commands.ok && privateCallbacks.ok && assets.ok && outputs.ok) {
		const seen = new Map<string, string>();
		const namespaces: Array<[string, readonly string[]]> = [
			['parameter', Object.keys(parameters.value)],
			['asset', Object.keys(assets.value)],
			['command', Object.keys(commands.value)],
			['private-callback', Object.keys(privateCallbacks.value)],
			['output', Object.keys(outputs.value)]
		];
		for (const [ns, keys] of namespaces) {
			for (const key of keys) {
				const owner = seen.get(key);
				if (owner !== undefined) {
					diagnostics.push(error('id/duplicate', `stable ID '${key}' is used by both ${owner} and ${ns}`, key));
				} else {
					seen.set(key, ns);
				}
			}
		}
	}

	// 7. inspector tree must resolve against the maps.
	if (parameters.ok && commands.ok && privateCallbacks.ok) {
		const tree = validateInspectorTree(e.inspectorTree, {
			parameters: new Set(Object.keys(parameters.value)),
			commands: new Set(Object.keys(commands.value)),
			callbacks: new Set(Object.keys(privateCallbacks.value))
		});
		if (!tree.ok) diagnostics.push(...tree.diagnostics);
	}

	if (diagnostics.length > 0) return fail(diagnostics);
	return ok(entry as CatalogEntry);
}
