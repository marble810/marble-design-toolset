/**
 * Open Project identity tests: stable Location ids, multi-Location isolation of the
 * SAME Project ID, and Manifest validation failures.
 */
import { describe, expect, test } from 'bun:test';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openProjectViaDialog, projectLocationIdFor, readProjectLocation, type DirectoryDialog } from '../src/main/project-location.ts';

async function makeTempDir(prefix: string): Promise<string> {
	return fs.mkdtemp(path.join(os.tmpdir(), `deshelf-desktop-${prefix}-`));
}

function writeManifest(dir: string, overrides: Record<string, unknown> = {}): Promise<void> {
	const manifest = {
		contractVersion: 1,
		projectId: '3e5a1c9b-7d24-4f8e-9a31-b2c8d6e4f5a7',
		slug: 'fixture-tool',
		name: 'Fixture Tool',
		version: '1.0.0',
		forgeProfile: 'forge-v1',
		libraries: [],
		...overrides
	};
	return fs.writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest), 'utf8');
}

async function makeProject(prefix: string, overrides: Record<string, unknown> = {}): Promise<string> {
	const dir = await makeTempDir(prefix);
	await writeManifest(dir, overrides);
	await fs.writeFile(path.join(dir, 'index.ts'), 'export default {};\n', 'utf8');
	return dir;
}

function dialogFor(filePath: string): DirectoryDialog {
	return { showOpenDialog: async () => ({ canceled: false, filePaths: [filePath] }) };
}

describe('project location identity', () => {
	test('reopening the same folder yields the same location id', async () => {
		const dir = await makeProject('stable');
		expect(await projectLocationIdFor(dir)).toBe(await projectLocationIdFor(dir));
		// Case-insensitive filesystems (Windows): different spelling, same id.
		const upper = dir.toUpperCase();
		const lower = dir.toLowerCase();
		const stats = await fs.stat(upper);
		expect(stats.isDirectory()).toBe(true);
		expect(await projectLocationIdFor(upper)).toBe(await projectLocationIdFor(lower));
	});

	test('same Project ID in two locations yields two distinct location ids', async () => {
		const dirA = await makeProject('multi-a');
		const dirB = await makeProject('multi-b');
		const a = await readProjectLocation(dirA);
		const b = await readProjectLocation(dirB);
		expect(a.ok && b.ok).toBe(true);
		if (a.ok && b.ok) {
			// Same immutable projectId…
			expect(a.location.manifest.projectId).toBe(b.location.manifest.projectId);
			// …but different Location identities.
			expect(a.location.info.projectLocationId).not.toBe(b.location.info.projectLocationId);
		}
	});

	test('invalid manifest is rejected with diagnostics', async () => {
		const dir = await makeTempDir('bad');
		await fs.writeFile(path.join(dir, 'manifest.json'), '{"slug": "broken"}', 'utf8');
		const result = await readProjectLocation(dir);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.diagnostics.length).toBeGreaterThan(0);
	});

	test('missing entry is rejected', async () => {
		const dir = await makeTempDir('noentry');
		await writeManifest(dir);
		const result = await readProjectLocation(dir);
		expect(result.ok).toBe(false);
	});

	test('openProjectViaDialog cancel and pick flows', async () => {
		const canceled = await openProjectViaDialog({ showOpenDialog: async () => ({ canceled: true }) });
		expect(canceled.ok).toBe(false);
		const dir = await makeProject('dialog');
		const picked = await openProjectViaDialog(dialogFor(dir));
		expect(picked.ok).toBe(true);
	});
});
