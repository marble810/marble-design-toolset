import { catalogEntryId, type CatalogEntry } from '../src/index.ts';

/**
 * Shared helper producing a fully valid Catalog Entry used by contract tests.
 * Deterministic: no timestamps, no random values, sorted maps.
 */
export function buildValidCatalogEntry(): CatalogEntry {
	const source = { kind: 'desktop', projectLocationId: 'proj-location-1' } as const;
	const projectId = '8f2c1a0e-1111-4222-8333-444455556666';
	return {
		catalogEntryId: catalogEntryId(source, projectId),
		source,
		projectId,
		slug: 'shallow-water',
		name: 'Shallow Water',
		description: 'Generate shallow-water height animations.',
		tags: ['simulation', 'height-map'],
		version: '1.0.0',
		forgeProfile: 'forge-v1',
		libraries: ['three'],
		artifacts: { main: 'main.js' },
		parameters: {
			amplitude: {
				id: 'amplitude',
				type: 'number',
				label: 'Amplitude',
				default: 0.5,
				mode: 'manual',
				constraint: { type: 'number', min: 0, max: 1, step: 0.01 }
			},
			sourceMode: {
				id: 'sourceMode',
				type: 'select',
				label: 'Source Mode',
				default: 'preset',
				mode: 'manual',
				constraint: { type: 'select', options: ['preset', 'image'] }
			}
		},
		assets: {
			initMap: { id: 'initMap', kind: 'image', label: 'Init Map', accept: ['image/png'], required: false }
		},
		commands: {
			resetView: { id: 'resetView', label: 'Reset View' }
		},
		privateCallbacks: {
			resimulate: { id: 'resimulate' }
		},
		outputs: {
			heightMap: { id: 'heightMap', kind: 'image', label: 'Height Map', mime: 'image/png' }
		},
		inspectorTree: {
			elements: [
				{ kind: 'slider', id: 'amp', label: 'Amplitude', binding: { kind: 'parameter', parameterId: 'amplitude' } },
				{
					kind: 'button',
					id: 'resim',
					label: 'Resimulate',
					binding: { kind: 'private-callback', callbackId: 'resimulate' }
				}
			]
		},
		surfaces: { canvas: true, slate: false }
	};
}
