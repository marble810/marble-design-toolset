/**
 * `.deshelf/` declarations tests: deterministic output, idempotent writes, and
 * idempotent `.gitignore` maintenance.
 */
import { describe, expect, test } from 'bun:test';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { CatalogEntry } from 'tool-contract';
import { ensureDeshelfIgnored, generateDeshelfFiles, writeDeshelfDeclarations } from '../src/main/declarations.ts';

const PROJECT_ID = '8f2c1a0e-1111-4222-8333-444455556666';

function entryFixture(): CatalogEntry {
	return {
		catalogEntryId: 'desktop_loc-aaaa_' + PROJECT_ID,
		source: { kind: 'desktop', projectLocationId: 'loc-aaaa' },
		projectId: PROJECT_ID,
		slug: 'fixture-tool',
		name: 'Fixture Tool',
		version: '1.0.0',
		forgeProfile: 'forge-v1',
		libraries: [],
		artifacts: { main: 'artifacts/main.js' },
		parameters: {
			speed: {
				id: 'speed',
				type: 'number',
				label: 'Speed',
				default: 1,
				mode: 'manual',
				constraint: { type: 'number', min: 0.1, max: 3, step: 0.1 }
			},
			enabled: { id: 'enabled', type: 'boolean', label: 'Enabled', default: true, mode: 'manual', constraint: { type: 'boolean' } },
			name: { id: 'name', type: 'string', label: 'Name', default: 'a', mode: 'manual', constraint: { type: 'string', maxLength: 32 } },
			shape: { id: 'shape', type: 'select', label: 'Shape', default: 'circle', mode: 'manual', constraint: { type: 'select', options: ['circle', 'square'] } },
			glow: {
				id: 'glow',
				type: 'number',
				label: 'Glow',
				default: 0.5,
				mode: 'computed',
				constraint: { type: 'number', min: 0, max: 1, step: 0.01 },
				dependsOn: ['speed']
			}
		},
		assets: { heightmap: { id: 'heightmap', kind: 'image', label: 'Heightmap' } },
		commands: { resetView: { id: 'resetView', label: 'Reset View' } as never },
		privateCallbacks: { ping: { id: 'ping' } },
		outputs: { frame: { id: 'frame', kind: 'image', label: 'Frame PNG', mime: 'image/png' } },
		inspectorTree: { elements: [{ kind: 'slider', id: 'speed', label: 'Speed', binding: { kind: 'parameter', parameterId: 'speed' } }] },
		surfaces: { canvas: true, slate: false }
	};
}

async function makeProjectDir(): Promise<string> {
	return fs.mkdtemp(path.join(os.tmpdir(), 'deshelf-desktop-deshelf-'));
}

describe('deshelf declarations', () => {
	test('deterministic: identical descriptors → byte-identical files', () => {
		const first = generateDeshelfFiles(entryFixture()).files;
		const second = generateDeshelfFiles(entryFixture()).files;
		expect(first['schema.json']).toBe(second['schema.json']);
		expect(first['parameters.d.ts']).toBe(second['parameters.d.ts']);
	});

	test('parameters.d.ts maps descriptor types and flags computed mode', () => {
		const dts = generateDeshelfFiles(entryFixture()).files['parameters.d.ts'] as string;
		expect(dts).toContain('"speed": number;');
		expect(dts).toContain('"enabled": boolean;');
		expect(dts).toContain('"name": string;');
		expect(dts).toContain('"shape": "circle" | "square";');
		expect(dts).toContain('"glow": number & { readonly mode: "computed" };');
	});

	test('schema.json carries all descriptor maps', () => {
		const schema = JSON.parse(generateDeshelfFiles(entryFixture()).files['schema.json'] as string) as Record<string, unknown>;
		expect(schema.parameters).toBeTruthy();
		expect(schema.assets).toBeTruthy();
		expect(schema.commands).toBeTruthy();
		expect(schema.privateCallbacks).toBeTruthy();
		expect(schema.outputs).toBeTruthy();
		expect(schema.inspectorTree).toBeTruthy();
		expect(schema.catalogEntryId).toContain(PROJECT_ID);
	});

	test('writes idempotently and maintains .gitignore idempotently', async () => {
		const dir = await makeProjectDir();
		const entry = entryFixture();

		const first = await writeDeshelfDeclarations(dir, entry);
		expect(first.written.sort()).toEqual(['parameters.d.ts', 'schema.json']);
		const gitignore1 = await fs.readFile(path.join(dir, '.gitignore'), 'utf8');
		expect(gitignore1).toContain('.deshelf/');

		const second = await writeDeshelfDeclarations(dir, entry);
		expect(second.written).toEqual([]);
		expect(second.unchanged.sort()).toEqual(['parameters.d.ts', 'schema.json']);

		// Re-running the gitignore maintenance must not duplicate the entry.
		expect(await ensureDeshelfIgnored(dir)).toBe(false);
		const gitignore2 = await fs.readFile(path.join(dir, '.gitignore'), 'utf8');
		expect(gitignore2).toBe(gitignore1);
	});

	test('changing descriptors rewrites the files', async () => {
		const dir = await makeProjectDir();
		const entry = entryFixture();
		await writeDeshelfDeclarations(dir, entry);
		const changed = { ...entry, parameters: {} };
		const result = await writeDeshelfDeclarations(dir, changed);
		expect(result.written.sort()).toEqual(['parameters.d.ts', 'schema.json']);
	});
});
