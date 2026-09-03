/**
 * Desktop Catalog persistence tests: per-Location files, same Project ID in multiple
 * Locations never overwriting each other, corrupt entries skipped, atomic location
 * removal.
 */
import { describe, expect, test } from 'bun:test';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateCatalogEntry, type CatalogEntry } from 'tool-contract';
import { desktopCatalogEntryId, DesktopCatalogService } from '../src/main/catalog-service.ts';
import type { ProjectLocationInfo } from '../src/shared/bridge-protocol.ts';

const PROJECT_ID = '8f2c1a0e-1111-4222-8333-444455556666';

function makeEntry(sourceId: string, projectId: string): CatalogEntry {
	const source = { kind: 'desktop', projectLocationId: sourceId } as const;
	return {
		catalogEntryId: desktopCatalogEntryId(sourceId, projectId),
		source,
		projectId,
		slug: 'fixture-tool',
		name: 'Fixture Tool',
		version: '1.0.0',
		forgeProfile: 'forge-v1',
		libraries: [],
		artifacts: { main: 'artifacts/main.js' },
		parameters: {},
		assets: {},
		commands: {},
		privateCallbacks: {},
		outputs: {},
		inspectorTree: { elements: [] },
		surfaces: { canvas: true, slate: false }
	};
}

function makeLocation(locationId: string, projectDir: string): ProjectLocationInfo {
	return {
		projectLocationId: locationId,
		projectDir,
		projectId: PROJECT_ID,
		slug: 'fixture-tool',
		name: 'Fixture Tool',
		version: '1.0.0',
		forgeProfile: 'forge-v1',
		libraries: []
	};
}

async function makeCacheRoot(): Promise<string> {
	return fs.mkdtemp(path.join(os.tmpdir(), 'deshelf-desktop-catalog-'));
}

describe('DesktopCatalogService', () => {
	test('same Project ID across two Locations coexists (multi-Location isolation)', async () => {
		const cacheRoot = await makeCacheRoot();
		const service = new DesktopCatalogService(cacheRoot);
		const locA = makeLocation('loc-aaaa', 'C:/projects/a');
		const locB = makeLocation('loc-bbbb', 'C:/projects/b');
		await service.upsertEntries(locA, [makeEntry(locA.projectLocationId, PROJECT_ID)]);
		await service.upsertEntries(locB, [makeEntry(locB.projectLocationId, PROJECT_ID)]);

		const records = await service.listRecords();
		expect(records).toHaveLength(2);
		const ids = new Set(records.map((record) => record.entry.catalogEntryId));
		expect(ids).toEqual(new Set([desktopCatalogEntryId('loc-aaaa', PROJECT_ID), desktopCatalogEntryId('loc-bbbb', PROJECT_ID)]));

		// Reload (upsert) only updates its own Location's entry.
		const updated = { ...makeEntry(locA.projectLocationId, PROJECT_ID), version: '2.0.0' };
		await service.upsertEntries(locA, [updated]);
		const after = await service.listRecords();
		expect(after).toHaveLength(2);
		const a2 = after.find((record) => record.location.projectLocationId === 'loc-aaaa');
		const b2 = after.find((record) => record.location.projectLocationId === 'loc-bbbb');
		expect(a2?.entry.version).toBe('2.0.0');
		expect(b2?.entry.version).toBe('1.0.0');
	});

	test('an entry tagged for a foreign location is rejected on upsert', async () => {
		const cacheRoot = await makeCacheRoot();
		const service = new DesktopCatalogService(cacheRoot);
		const locA = makeLocation('loc-aaaa', 'C:/projects/a');
		const foreign = makeEntry('loc-9999', PROJECT_ID);
		await service.upsertEntries(locA, [foreign]);
		expect(await service.listRecords()).toHaveLength(0);
	});

	test('invalid persisted entries are skipped with a sane load', async () => {
		const cacheRoot = await makeCacheRoot();
		const service = new DesktopCatalogService(cacheRoot);
		const locA = makeLocation('loc-aaaa', 'C:/projects/a');
		const valid = makeEntry(locA.projectLocationId, PROJECT_ID);
		await service.upsertEntries(locA, [valid]);
		// Corrupt one entry in the persisted file.
		const file = path.join(cacheRoot, 'catalogs', 'loc-aaaa.json');
		const parsed = JSON.parse(await fs.readFile(file, 'utf8')) as { entries: unknown[] };
		parsed.entries.push({ broken: true });
		await fs.writeFile(file, JSON.stringify(parsed), 'utf8');
		const records = await service.listRecords();
		expect(records).toHaveLength(1);
		expect(validateCatalogEntry(records[0].entry).ok).toBe(true);
	});

	test('forgetLocation removes the location and its catalog file', async () => {
		const cacheRoot = await makeCacheRoot();
		const service = new DesktopCatalogService(cacheRoot);
		const locA = makeLocation('loc-aaaa', 'C:/projects/a');
		await service.upsertEntries(locA, [makeEntry(locA.projectLocationId, PROJECT_ID)]);
		await service.forgetLocation('loc-aaaa');
		expect(await service.listRecords()).toHaveLength(0);
		expect(await fs.stat(path.join(cacheRoot, 'catalogs', 'loc-aaaa.json')).then(() => true).catch(() => false)).toBe(false);
	});

	test('current build pointer round trip', async () => {
		const cacheRoot = await makeCacheRoot();
		const service = new DesktopCatalogService(cacheRoot);
		expect(await service.getCurrentBuild('loc-aaaa')).toBeUndefined();
		await service.setCurrentBuild('loc-aaaa', 'abc123');
		expect(await service.getCurrentBuild('loc-aaaa')).toBe('abc123');
	});
});
