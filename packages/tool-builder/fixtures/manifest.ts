/**
 * Deterministic Tool Project manifest used by extraction tests.
 */
import type { ToolManifest } from 'tool-contract';

export const PROJECT_ID = '8f2c1a0e-1111-4222-8333-444455556666';

export const VALID_MANIFEST: ToolManifest = {
	contractVersion: 1,
	projectId: PROJECT_ID,
	slug: 'shallow-water',
	name: 'Shallow Water',
	description: 'Generate shallow-water height animations.',
	tags: ['simulation', 'height-map'],
	version: '1.0.0',
	forgeProfile: 'forge-v1',
	libraries: ['three']
};

export const DESKTOP_SOURCE = { kind: 'desktop', projectLocationId: 'proj-location-1' } as const;

export const ARTIFACTS = { main: 'shallow-water/main.js' } as const;
