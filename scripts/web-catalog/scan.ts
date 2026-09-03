/**
 * Web Tool Project scan: walks a convention root (default `tools/`) and classifies each
 * depth-1 directory. A directory qualifies as a candidate Tool Project only when its
 * `manifest.json` carries Deshelf identity fields (contractVersion/projectId/
 * forgeProfile) — everything else (legacy tools, random folders, foreign manifests) is
 * ignored silently per the Catalog contract ("Forge 遇到无关 Manifest → 忽略").
 * A Deshelf-looking manifest that FAILS validation is reported as a failure.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { validateManifest, error, type Diagnostic, type ToolManifest } from 'tool-contract';

export interface ToolProjectCandidate {
	/** Absolute directory of the Tool Project. */
	projectDir: string;
	/** Directory name (informational; the slug comes from the Manifest). */
	folderName: string;
	manifest: ToolManifest;
}

export interface ToolProjectFailure {
	projectDir: string;
	folderName: string;
	reason: 'invalid-manifest' | 'duplicate-slug' | 'duplicate-project-id' | 'build';
	diagnostics: readonly Diagnostic[];
}

const IDENTITY_FIELDS = ['contractVersion', 'projectId', 'forgeProfile'] as const;

/** True when the raw JSON looks like a Deshelf Manifest (any identity field present). */
function looksLikeDeshelfManifest(raw: unknown): boolean {
	if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return false;
	const record = raw as Record<string, unknown>;
	return IDENTITY_FIELDS.some((field) => record[field] !== undefined);
}

export interface ScanResult {
	candidates: ToolProjectCandidate[];
	failures: ToolProjectFailure[];
}

export async function scanToolProjects(toolsRoot: string): Promise<ScanResult> {
	const candidates: ToolProjectCandidate[] = [];
	const failures: ToolProjectFailure[] = [];

	let dirents;
	try {
		dirents = await fs.readdir(toolsRoot, { withFileTypes: true });
	} catch (err) {
		const code = (err as NodeJS.ErrnoException).code;
		if (code === 'ENOENT') return { candidates, failures };
		throw err;
	}

	for (const dirent of dirents.sort((a, b) => (a.name < b.name ? -1 : 1))) {
		if (!dirent.isDirectory()) continue;
		const projectDir = path.resolve(toolsRoot, dirent.name);
		const manifestPath = path.join(projectDir, 'manifest.json');
		let raw: unknown;
		try {
			raw = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
		} catch (err) {
			const code = (err as NodeJS.ErrnoException).code;
			if (code === 'ENOENT') continue; // not a Tool Project at all
			// Once a directory contains manifest.json it is a candidate worth diagnosing;
			// malformed JSON cannot be inspected for identity fields.
			failures.push({
				projectDir,
				folderName: dirent.name,
				reason: 'invalid-manifest',
				diagnostics: [error('build/manifest-read', `manifest.json could not be parsed: ${String(err)}`)]
			});
			continue;
		}
		if (!looksLikeDeshelfManifest(raw)) continue; // foreign manifest → ignore
		const validation = validateManifest(raw);
		if (!validation.ok) {
			failures.push({ projectDir, folderName: dirent.name, reason: 'invalid-manifest', diagnostics: validation.diagnostics });
			continue;
		}
		candidates.push({ projectDir, folderName: dirent.name, manifest: validation.value });
	}

	// Deterministic uniqueness: web artifacts are laid out by slug, and the
	// catalogEntryId is derived from the Project ID — duplicates fail the later entry.
	const seenSlugs = new Map<string, string>();
	const seenProjectIds = new Map<string, string>();
	const uniqueCandidates: ToolProjectCandidate[] = [];
	for (const candidate of candidates) {
		const slugOwner = seenSlugs.get(candidate.manifest.slug);
		if (slugOwner !== undefined) {
			failures.push({
				projectDir: candidate.projectDir,
				folderName: candidate.folderName,
				reason: 'duplicate-slug',
				diagnostics: [error('catalog/duplicate-slug', `slug '${candidate.manifest.slug}' already used by '${slugOwner}'`, candidate.manifest.slug)]
			});
			continue;
		}
		const idOwner = seenProjectIds.get(candidate.manifest.projectId);
		if (idOwner !== undefined) {
			failures.push({
				projectDir: candidate.projectDir,
				folderName: candidate.folderName,
				reason: 'duplicate-project-id',
				diagnostics: [error('catalog/duplicate-project-id', `projectId '${candidate.manifest.projectId}' already used by '${idOwner}'`, candidate.manifest.projectId)]
			});
			continue;
		}
		seenSlugs.set(candidate.manifest.slug, candidate.folderName);
		seenProjectIds.set(candidate.manifest.projectId, candidate.folderName);
		uniqueCandidates.push(candidate);
	}

	return { candidates: uniqueCandidates, failures };
}
