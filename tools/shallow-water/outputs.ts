/**
 * Visual Output definitions (stable IDs from this map's keys).
 *
 * The descriptors below are what the Catalog carries; the render callbacks stay in the
 * Main artifact and run inside the Container when the Host executes `export.*`. Both
 * outputs replay the deterministic simulation state owned by the Canvas session runtime
 * (see sim/session.ts) — the Canvas never registers an exporter at runtime.
 */
import { requireActiveSessionRuntime } from './sim/session.ts';

export const OUTPUT_DEFINITIONS = {
	heightMap: {
		kind: 'image' as const,
		label: 'Height Map PNG',
		mime: 'image/png',
		async render(): Promise<Blob> {
			const runtime = requireActiveSessionRuntime();
			const initialData = runtime.currentInitialData();
			if (initialData === null) throw new Error('no init map loaded yet');
			const { exportStillBlob } = await import('./sim/export-replay.ts');
			return exportStillBlob(runtime.currentSimParameters(), initialData);
		}
	},
	simulationVideo: {
		kind: 'video' as const,
		label: 'Simulation Video',
		// Primary intent; the recorded Blob's own type (mp4 or webm fallback) wins.
		mime: 'video/mp4',
		async render(): Promise<Blob> {
			const runtime = requireActiveSessionRuntime();
			const initialData = runtime.currentInitialData();
			if (initialData === null) throw new Error('no init map loaded yet');
			const { exportVideoBlob } = await import('./sim/export-replay.ts');
			const { blob } = await exportVideoBlob(runtime.currentSimParameters(), initialData);
			return blob;
		}
	}
};
