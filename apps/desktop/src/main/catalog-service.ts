/**
 * Desktop Project Catalog persistence (Deshelf Host for Desktop).
 *
 * One Catalog file per Project Location: `catalogs/<projectLocationId>.json`. The
 * primary key inside a file is the Host-local `catalogEntryId`, which is derived from
 * `{ kind: 'desktop', projectLocationId } + projectId` — so the SAME Project
 * ID opened from multiple Locations produces distinct, coexisting entries, and Reload
 * upserts only its own Location's entry. The Location index (`catalogs/index.json`)
 * keeps the Host UI's Open Project list; losing it never loses entries.
 *
 * Writes are atomic (tmp file + rename); readers validate entries on load and skip
 * invalid ones with diagnostics instead of poisoning the usable Catalog.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { catalogEntryId, validateCatalogEntry, type CatalogEntry, type Diagnostic } from 'tool-contract';
import type { ProjectLocationInfo } from '../shared/bridge-protocol.ts';
import { createCachePaths, type DesktopCachePaths } from './paths.ts';

const CATALOG_VERSION = 1;

export interface DesktopCatalogSource {
	kind: 'desktop';
	projectLocationId: string;
}

export function desktopSourceFor(projectLocationId: string): DesktopCatalogSource {
	return { kind: 'desktop', projectLocationId };
}

export function desktopCatalogEntryId(projectLocationId: string, projectId: string): string {
	return catalogEntryId(desktopSourceFor(projectLocationId), projectId);
}

interface LocationCatalogFile {
	version: number;
	source: DesktopCatalogSource;
	entries: CatalogEntry[];
}

interface LocationIndexFile {
	version: number;
	locations: Record<string, ProjectLocationInfo>;
	/** Current published build per Location (source hash → cache URL derivation). */
	builds: Record<string, string>;
}

export interface DesktopCatalogRecord {
	location: ProjectLocationInfo;
	entry: CatalogEntry;
}

export class DesktopCatalogService {
	private readonly paths: DesktopCachePaths;

	constructor(cacheRoot: string) {
		this.paths = createCachePaths(cacheRoot);
	}

	// ------------------------------------------------------------------ locations

	async ensureDirs(): Promise<void> {
		await fs.mkdir(this.paths.catalogs, { recursive: true });
		await fs.mkdir(this.paths.builds, { recursive: true });
		await fs.mkdir(this.paths.tmp, { recursive: true });
	}

	async rememberLocation(location: ProjectLocationInfo): Promise<void> {
		await this.ensureDirs();
		const index = await this.readIndex();
		index.locations[location.projectLocationId] = location;
		await this.writeAtomic(this.paths.catalogIndex, `${JSON.stringify(index, null, 2)}\n`);
	}

	async forgetLocation(projectLocationId: string): Promise<void> {
		const index = await this.readIndex();
		delete index.locations[projectLocationId];
		await this.writeAtomic(this.paths.catalogIndex, `${JSON.stringify(index, null, 2)}\n`);
		await fs.rm(path.join(this.paths.catalogs, `${projectLocationId}.json`), { force: true });
	}

	async listLocations(): Promise<ProjectLocationInfo[]> {
		const index = await this.readIndex();
		return Object.values(index.locations).sort((a, b) => (a.slug < b.slug ? -1 : 1));
	}

	async getLocation(projectLocationId: string): Promise<ProjectLocationInfo | undefined> {
		return (await this.readIndex()).locations[projectLocationId];
	}

	/** Records the published source hash for a Location (current build pointer). */
	async setCurrentBuild(projectLocationId: string, sourceHash: string): Promise<void> {
		await this.ensureDirs();
		const index = await this.readIndex();
		index.builds[projectLocationId] = sourceHash;
		await this.writeAtomic(this.paths.catalogIndex, `${JSON.stringify(index, null, 2)}\n`);
	}

	async getCurrentBuild(projectLocationId: string): Promise<string | undefined> {
		return (await this.readIndex()).builds[projectLocationId];
	}

	// ------------------------------------------------------------------ entries

	/** Upserts one Location's entries (idempotent Reload); other Locations untouched. */
	async upsertEntries(location: ProjectLocationInfo, entries: readonly CatalogEntry[]): Promise<void> {
		await this.ensureDirs();
		const source = desktopSourceFor(location.projectLocationId);
		const byId = new Map<string, CatalogEntry>();
		const file = await this.readLocationFile(location.projectLocationId);
		for (const entry of file?.entries ?? []) byId.set(entry.catalogEntryId, entry);
		for (const entry of entries) {
			// Defense in depth: an entry tagged for a foreign Location is rejected, so a
			// bug elsewhere can never overwrite another Location's tools.
			if (entry.catalogEntryId !== desktopCatalogEntryId(location.projectLocationId, entry.projectId)) continue;
			byId.set(entry.catalogEntryId, entry);
		}
		const outFile: LocationCatalogFile = { version: CATALOG_VERSION, source, entries: [...byId.values()] };
		await this.writeAtomic(
			path.join(this.paths.catalogs, `${location.projectLocationId}.json`),
			`${JSON.stringify(outFile, null, 2)}\n`
		);
		await this.rememberLocation(location);
	}

	/** All valid entries across every known Location, oldest-slug-first. */
	async listRecords(): Promise<DesktopCatalogRecord[]> {
		const index = await this.readIndex();
		const records: DesktopCatalogRecord[] = [];
		for (const location of Object.values(index.locations)) {
			const file = await this.readLocationFile(location.projectLocationId);
			for (const raw of file?.entries ?? []) {
				const validation = validateCatalogEntry(raw);
				if (validation.ok) records.push({ location, entry: validation.value });
			}
		}
		records.sort((a, b) => (a.entry.catalogEntryId < b.entry.catalogEntryId ? -1 : 1));
		return records;
	}

	async getRecord(catalogEntryId: string): Promise<DesktopCatalogRecord | undefined> {
		return (await this.listRecords()).find((record) => record.entry.catalogEntryId === catalogEntryId);
	}

	// ------------------------------------------------------------------ internals

	private async readIndex(): Promise<LocationIndexFile> {
		try {
			const raw = JSON.parse(await fs.readFile(this.paths.catalogIndex, 'utf8')) as LocationIndexFile;
			if (raw !== null && typeof raw === 'object' && typeof raw.locations === 'object' && raw.locations !== null) {
				return {
					version: CATALOG_VERSION,
					locations: raw.locations,
					builds: typeof raw.builds === 'object' && raw.builds !== null ? raw.builds : {}
				};
			}
		} catch {
			// missing/corrupt index: start empty, entries survive in per-Location files
		}
		return { version: CATALOG_VERSION, locations: {}, builds: {} };
	}

	private async readLocationFile(projectLocationId: string): Promise<LocationCatalogFile | undefined> {
		if (!/^[A-Za-z0-9-]+$/.test(projectLocationId)) return undefined;
		try {
			const raw = JSON.parse(
				await fs.readFile(path.join(this.paths.catalogs, `${projectLocationId}.json`), 'utf8')
			) as LocationCatalogFile;
			if (raw === null || typeof raw !== 'object' || !Array.isArray(raw.entries)) return undefined;
			return raw;
		} catch {
			return undefined;
		}
	}

	private async writeAtomic(target: string, content: string): Promise<void> {
		await fs.mkdir(path.dirname(target), { recursive: true });
		const tmp = `${target}.${process.pid}.tmp`;
		await fs.writeFile(tmp, content, 'utf8');
		await fs.rename(tmp, target);
	}
}

export type { Diagnostic };
