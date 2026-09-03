/**
 * Static Catalog source tests: load + validation + artifact URL resolution. The fetch
 * seam is injected for determinism (no real HTTP in unit tests).
 */
import { describe, expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { catalogEntryId, type CatalogEntry } from 'tool-contract';
import { StaticCatalogSource, type StaticCatalogFile } from './static-catalog-source.js';

const BASE = 'https://deshelf.test/deshelf/catalog.json';

function entry(slug: string, projectId: string): CatalogEntry {
	const source = { kind: 'web', sourceId: 'bundled' } as const;
	return {
		catalogEntryId: catalogEntryId(source, projectId),
		source,
		projectId,
		slug,
		name: slug,
		version: '1.0.0',
		forgeProfile: 'forge-v1',
		libraries: [],
		artifacts: { main: `artifacts/${slug}/main.js`, ...(slug === 'with-slate' ? { slate: `artifacts/${slug}/chunks/slate.js` } : {}) },
		parameters: {},
		assets: {},
		commands: {},
		privateCallbacks: {},
		outputs: {},
		inspectorTree: { elements: [] },
		surfaces: { canvas: true, slate: slug === 'with-slate' }
	};
}

function sourceWith(entries: unknown[]): StaticCatalogSource {
	const file: StaticCatalogFile = { version: 1, source: { kind: 'web', sourceId: 'bundled' }, entries: entries as CatalogEntry[] };
	const fetchImpl = (async () => new Response(JSON.stringify(file), { status: 200 })) as unknown as typeof fetch;
	return new StaticCatalogSource(BASE, { fetchImpl });
}

describe('StaticCatalogSource', () => {
	test('loads, validates and lists entries; resolves artifact URLs against the catalog URL', async () => {
		const source = sourceWith([entry('alpha', 'p-alpha'), entry('with-slate', 'p-slate')]);
		await source.load();
		expect(source.list().map((e) => e.slug)).toEqual(['alpha', 'with-slate']);
		expect(source.get(catalogEntryId({ kind: 'web', sourceId: 'bundled' }, 'p-alpha'))?.slug).toBe('alpha');

		const resolved = source.resolveArtifactUrls(source.list()[0]);
		expect(resolved.main).toBe('https://deshelf.test/deshelf/artifacts/alpha/main.js');
		const slate = source.resolveArtifactUrls(source.list()[1]);
		expect(slate.slate).toBe('https://deshelf.test/deshelf/artifacts/with-slate/chunks/slate.js');
	});

	test('skips invalid entries with diagnostics instead of failing the load', async () => {
		const broken = { catalogEntryId: 'nonsense', slug: 42 };
		const source = sourceWith([entry('alpha', 'p-alpha'), broken]);
		await source.load();
		expect(source.list().map((e) => e.slug)).toEqual(['alpha']);
		expect(source.getDiagnostics().length).toBeGreaterThan(0);
	});

	test('load failures throw with the HTTP status', async () => {
		const fetchImpl = (async () => new Response('nope', { status: 404 })) as unknown as typeof fetch;
		const source = new StaticCatalogSource(BASE, { fetchImpl });
		await expect(source.load()).rejects.toThrow(/404/);
		assert.ok(true);
	});
});
