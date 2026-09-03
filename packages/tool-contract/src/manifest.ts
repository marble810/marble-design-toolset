/**
 * Tool Manifest: the only static identity + Forge environment record of a Tool Project.
 * It MUST NOT carry entry paths, Parameters, Commands, Inspector, Capability, Slate or Export.
 */
import { fail, ok, error, type Diagnostic, type Result } from './diagnostics.ts';

export const CONTRACT_VERSION = 1 as const;
export type ContractVersion = typeof CONTRACT_VERSION;

export const SUPPORTED_LIBRARIES = ['three', 'pixi', 'gsap', 'vgpu'] as const;
export type FrameworkLibraryId = (typeof SUPPORTED_LIBRARIES)[number];

/** Stable IDs (map keys) use lowercase-first camelCase. */
export const ID_PATTERN = /^[a-z][a-zA-Z0-9]*$/;
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

export interface ToolManifest {
	contractVersion: ContractVersion;
	projectId: string;
	slug: string;
	name: string;
	description?: string;
	tags?: string[];
	version: string;
	forgeProfile: string;
	libraries: FrameworkLibraryId[];
}

/**
 * Fields the Manifest contract allows. The Manifest is a closed schema: only static
 * identity, contractVersion, forgeProfile, libraries and optional static metadata
 * (description/tags) are permitted. Everything else belongs to the Tool Entry/Catalog.
 */
export const ALLOWED_MANIFEST_FIELDS = [
	'contractVersion',
	'projectId',
	'slug',
	'name',
	'version',
	'forgeProfile',
	'libraries',
	'description',
	'tags'
] as const;

/** Fields that the Manifest contract explicitly forbids; they belong to the Tool Entry / Catalog. */
export const FORBIDDEN_MANIFEST_FIELDS = ['entry', 'parameters', 'commands', 'inspector', 'capability', 'slate', 'export'] as const;

export function validateManifest(input: unknown): Result<ToolManifest> {
	if (input === null || typeof input !== 'object' || Array.isArray(input)) {
		return fail([error('manifest/identity', 'Manifest must be a JSON object')]);
	}
	const m = input as Record<string, unknown>;
	const diagnostics: Diagnostic[] = [];

	// Closed schema: reject every unknown field, including enabled/assets/outputs/
	// privateCallbacks/surfaces and anything not in the allowed static set.
	for (const key of Object.keys(m)) {
		if (!(ALLOWED_MANIFEST_FIELDS as readonly string[]).includes(key)) {
			diagnostics.push(error('manifest/unknown-field', `Manifest MUST NOT declare '${key}'`, key));
		}
	}

	for (const key of FORBIDDEN_MANIFEST_FIELDS) {
		if (key in m) {
			diagnostics.push(error('manifest/forbidden-field', `Manifest MUST NOT declare '${key}'`));
		}
	}

	if (m.contractVersion !== CONTRACT_VERSION) {
		diagnostics.push(error('manifest/contract-version', `Unsupported contractVersion ${String(m.contractVersion)}`));
	}
	if (typeof m.projectId !== 'string' || m.projectId.length === 0) {
		diagnostics.push(error('manifest/identity', 'Manifest requires a non-empty projectId'));
	}
	if (typeof m.slug !== 'string' || !SLUG_PATTERN.test(m.slug)) {
		diagnostics.push(error('manifest/slug', 'slug must match kebab-case', 'slug'));
	}
	if (typeof m.name !== 'string' || m.name.length === 0) {
		diagnostics.push(error('manifest/identity', 'Manifest requires a non-empty name'));
	}
	if (typeof m.version !== 'string' || !SEMVER_PATTERN.test(m.version)) {
		diagnostics.push(error('manifest/version', 'version must be semver (major.minor.patch)', 'version'));
	}
	if (typeof m.forgeProfile !== 'string' || m.forgeProfile.length === 0) {
		diagnostics.push(error('manifest/forge-profile', 'Manifest requires a forgeProfile', 'forgeProfile'));
	}

	const libraries = m.libraries;
	if (!Array.isArray(libraries)) {
		diagnostics.push(error('manifest/library', 'libraries must be an array', 'libraries'));
	} else {
		for (const lib of libraries) {
			if (typeof lib !== 'string' || !(SUPPORTED_LIBRARIES as readonly string[]).includes(lib)) {
				diagnostics.push(error('manifest/library', `Unsupported Framework Library '${String(lib)}'`, 'libraries'));
			}
		}
	}
	if (m.description !== undefined && typeof m.description !== 'string') {
		diagnostics.push(error('manifest/description', 'description must be a string', 'description'));
	}
	if (
		m.tags !== undefined &&
		(!Array.isArray(m.tags) || !m.tags.every((tag) => typeof tag === 'string'))
	) {
		diagnostics.push(error('manifest/tags', 'tags must be an array of strings', 'tags'));
	}

	if (diagnostics.length > 0) return fail(diagnostics);

	const description = m.description as string | undefined;
	const tags = m.tags as string[] | undefined;

	return ok({
		contractVersion: CONTRACT_VERSION,
		projectId: m.projectId as string,
		slug: m.slug as string,
		name: m.name as string,
		...(description !== undefined ? { description } : {}),
		...(tags !== undefined ? { tags } : {}),
		version: m.version as string,
		forgeProfile: m.forgeProfile as string,
		libraries: libraries as FrameworkLibraryId[]
	});
}
