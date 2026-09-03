/**
 * Open Project / Project Location identity.
 *
 * A Desktop Tool Project is any user-chosen directory containing a valid
 * `manifest.json` + fixed `index.ts`. `projectId` is the immutable logical identity
 * from the Manifest; `projectLocationId` is derived from the resolved absolute
 * directory path (realpath, case-normalized via the filesystem itself), so:
 * - reopening the same folder yields the same Location id (stable cache/Catalog keys);
 * - the SAME Project ID opened from TWO locations yields two independent Locations
 *   whose cache and Catalog entries never collide.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validateManifest, type Diagnostic, type ToolManifest } from 'tool-contract';
import type { ProjectLocationInfo } from '../shared/bridge-protocol.ts';

export interface ProjectLocation {
	info: ProjectLocationInfo;
	manifest: ToolManifest;
}

export interface OpenProjectFailure {
	ok: false;
	diagnostics: readonly Diagnostic[];
}

export interface OpenProjectSuccess {
	ok: true;
	location: ProjectLocation;
}

/** Directory dialog contract (structural subset of Electron `Dialog`). */
export interface DirectoryDialog {
	showOpenDialog(options: {
		title?: string;
		properties: ReadonlyArray<'openDirectory' | 'openFile'>;
	}): Promise<{ canceled: boolean; filePaths?: string[] }>;
}

/**
 * Stable id for a Project Location: SHA-256 of the case-normalized realpath. Windows
 * filesystems are case-insensitive; realpath returns the on-disk casing, which makes
 * the hash stable across `D:\git\Tool` vs `d:\git\tool` spellings.
 */
export async function projectLocationIdFor(projectDir: string): Promise<string> {
	const real = await fs.realpath(path.resolve(projectDir));
	return `loc-${createHash('sha256').update(real).digest('hex').slice(0, 16)}`;
}

/** Reads + validates the identity of a candidate Open Project directory. */
export async function readProjectLocation(projectDir: string): Promise<OpenProjectSuccess | OpenProjectFailure> {
	const resolved = path.resolve(projectDir);
	const manifestPath = path.join(resolved, 'manifest.json');

	let raw: unknown;
	try {
		raw = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
	} catch (err) {
		return {
			ok: false,
			diagnostics: [
				{ severity: 'error', code: 'project/manifest-read', message: `manifest.json could not be read: ${err instanceof Error ? err.message : String(err)}` }
			]
		};
	}
	const manifest = validateManifest(raw);
	if (!manifest.ok) {
		return { ok: false, diagnostics: manifest.diagnostics };
	}

	try {
		const entryStat = await fs.stat(path.join(resolved, 'index.ts'));
		if (!entryStat.isFile()) throw new Error('index.ts is not a file');
	} catch (err) {
		return {
			ok: false,
			diagnostics: [
				{ severity: 'error', code: 'project/entry-missing', message: `fixed Tool Entry index.ts is missing: ${err instanceof Error ? err.message : String(err)}` }
			]
		};
	}

	const projectLocationId = await projectLocationIdFor(resolved);
	const m = manifest.value;
	return {
		ok: true,
		location: {
			manifest: m,
			info: {
				projectLocationId,
				projectDir: resolved,
				projectId: m.projectId,
				slug: m.slug,
				name: m.name,
				version: m.version,
				forgeProfile: m.forgeProfile,
				libraries: m.libraries
			}
		}
	};
}

/** Open Project workflow: directory dialog → identity validation. */
export async function openProjectViaDialog(
	dialog: DirectoryDialog,
	options?: { title?: string }
): Promise<OpenProjectSuccess | OpenProjectFailure | { ok: false; canceled: true; diagnostics: Diagnostic[] }> {
	const result = await dialog.showOpenDialog({
		title: options?.title ?? 'Open Deshelf Tool Project',
		properties: ['openDirectory']
	});
	if (result.canceled || result.filePaths === undefined || result.filePaths.length === 0) {
		return { ok: false, canceled: true, diagnostics: [] };
	}
	return readProjectLocation(result.filePaths[0] as string);
}
