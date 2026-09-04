/**
 * Per-session Shallow Water runtime (the frozen "createRuntime" seam).
 *
 * One instance owns everything simulation-related for one Tool Session inside one
 * container realm: the attached preview canvas, the rAF loop, the decoded init-map
 * height field and the deterministic export inputs. The Canvas creates it on mount;
 * the Tool Entry's outputs/private callbacks/commands reach the same instance through
 * the realm-scoped holder in `session.ts` — a realm is created per Session (Reload/
 * Restart replace the realm), so this never leaks state across Sessions and there is
 * no global registration.
 *
 * Parameter/Asset mirrors are consumed here: structural changes (source, resolution,
 * amplitude, invert, resimulate token) re-seed the height field exactly like the old
 * tool-owned component did, while non-structural changes only affect the next step.
 */
import type { ContainerSurfaceContext } from '@deshelf/tool-sdk';
import type { AssetContent, ParameterValue } from 'tool-contract';
import { presetFromParameterValues } from '../preset-init-map.ts';
import {
	readSimParameters,
	structuralSimKey,
	type SimParameters
} from '../parameters.ts';
import { createInitMapSourceKey, loadInitMapHeightData, type InitMapSource } from './height-data.ts';
import { ShallowWaterWaveRenderer } from './renderer.ts';

export type RuntimeStatus =
	| { kind: 'idle'; message: string }
	| { kind: 'loading' }
	| { kind: 'ready'; resolution: number }
	| { kind: 'error'; message: string };

export interface ShallowWaterRuntime {
	/** Creates the preview renderer on the canvas and starts the animation loop. */
	attach(canvas: HTMLCanvasElement): void;
	/** Forces a re-seed from the current init-map source (Inspector private callback). */
	resimulate(): void;
	/** Current decoded initial height field, or null before the first re-seed. */
	currentInitialData(): Float32Array | null;
	/** Numeric view of the latest Parameter snapshot. */
	currentSimParameters(): SimParameters;
	getStatus(): RuntimeStatus;
	subscribeStatus(listener: (status: RuntimeStatus) => void): () => void;
	dispose(): void;
}

const IDLE_IMAGE_MODE: RuntimeStatus = { kind: 'idle', message: 'Load an init map image or switch to preset mode.' };

function assetToSource(content: AssetContent | null | undefined): InitMapSource | null {
	if (content === null || content === undefined || content.kind !== 'blob-url') return null;
	return { kind: 'image', url: content.url };
}

export function createShallowWaterRuntime(context: ContainerSurfaceContext): ShallowWaterRuntime {
	let canvas: HTMLCanvasElement | null = null;
	let renderer: ShallowWaterWaveRenderer | null = null;
	let rendererResolution = 0;
	let initialData: Float32Array | null = null;
	let structuralKey = '';
	let resimulateToken = 0;
	let loadVersion = 0;
	let disposed = false;
	let rafHandle = 0;
	let status: RuntimeStatus = { kind: 'loading' };
	const statusListeners = new Set<(next: RuntimeStatus) => void>();

	const parameterUnsubscribe = context.parameters.subscribe(() => scheduleSync());
	const assetUnsubscribe = context.assets.subscribe(() => scheduleSync());

	function setStatus(next: RuntimeStatus): void {
		if (disposed) return;
		status = next;
		for (const listener of [...statusListeners]) listener(next);
	}

	function currentValues(): Record<string, ParameterValue> {
		return context.parameters.snapshot().values;
	}

	function activeSource(values: Record<string, ParameterValue>): InitMapSource | null {
		const mode = values.sourceMode === 'image' ? 'image' : 'preset';
		if (mode === 'image') {
			const content = context.assets.values().initMap;
			if (content === null || content === undefined) return null;
			return assetToSource(content);
		}
		return { kind: 'preset', preset: presetFromParameterValues(values) };
	}

	function scheduleSync(): void {
		if (disposed) return;
		void sync();
	}

	/**
	 * Recomputes the structural key from the latest mirrors; re-seeds (and, on a
	 * resolution change, rebuilds the renderer) when the initial state must change.
	 */
	async function sync(): Promise<void> {
		if (disposed) return;
		const values = currentValues();
		const sim = readSimParameters(values);

		// Old tool behavior: picking an image switches the source mode to image.
		const assetContent = context.assets.values().initMap;
		if (assetContent !== null && assetContent !== undefined && assetContent.kind === 'blob-url') {
			const snapshot = context.parameters.snapshot();
			if (snapshot.values.sourceMode !== 'image') {
				void context
					.setParameter('sourceMode', 'image', snapshot.revisions.sourceMode ?? snapshot.revision)
					.catch(() => {
						// The Store may reject (revision race) — the next snapshot retriggers sync.
					});
			}
		}

		const source = activeSource(values);
		if (source === null) {
			initialData = null;
			structuralKey = '';
			setStatus(IDLE_IMAGE_MODE);
			return;
		}

		const sourceKey = createInitMapSourceKey(source);
		const nextKey = structuralSimKey(sim, sourceKey, resimulateToken);
		if (nextKey === structuralKey && renderer !== null) return;
		structuralKey = nextKey;

		if (renderer === null || rendererResolution !== sim.resolution) {
			if (canvas !== null) {
				renderer?.dispose();
				renderer = new ShallowWaterWaveRenderer(canvas, sim.resolution);
				rendererResolution = sim.resolution;
				canvas.width = sim.resolution;
				canvas.height = sim.resolution;
			} else {
				return;
			}
		}

		const version = ++loadVersion;
		setStatus({ kind: 'loading' });
		try {
			const heightData = await loadInitMapHeightData(source, sim);
			if (disposed || version !== loadVersion || renderer === null) return;
			initialData = heightData;
			renderer.setInitialHeight(heightData);
			renderer.render(sim);
			setStatus({ kind: 'ready', resolution: sim.resolution });
		} catch (error) {
			if (disposed || version !== loadVersion) return;
			initialData = null;
			structuralKey = '';
			setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'Failed to read init map.' });
		}
	}

	function attach(targetCanvas: HTMLCanvasElement): void {
		if (disposed) return;
		canvas = targetCanvas;
		const sim = readSimParameters(currentValues());
		canvas.width = sim.resolution;
		canvas.height = sim.resolution;
		renderer = new ShallowWaterWaveRenderer(canvas, sim.resolution);
		rendererResolution = sim.resolution;
		// Subscriptions may have synced before the canvas existed; force one re-seed now
		// that the renderer can actually receive the initial height field.
		structuralKey = '';

		const loop = () => {
			if (disposed) return;
			rafHandle = requestAnimationFrame(loop);
			if (renderer !== null && initialData !== null) {
				const nextSim = readSimParameters(currentValues());
				renderer.advanceFrames(1, nextSim);
				renderer.render(nextSim);
			}
		};
		rafHandle = requestAnimationFrame(loop);

		void sync();
	}

	function resimulate(): void {
		if (disposed) return;
		resimulateToken += 1;
		void sync();
	}

	function currentInitialData(): Float32Array | null {
		return initialData;
	}

	function currentSimParameters(): SimParameters {
		return readSimParameters(currentValues());
	}

	function dispose(): void {
		if (disposed) return;
		disposed = true;
		cancelAnimationFrame(rafHandle);
		parameterUnsubscribe();
		assetUnsubscribe();
		loadVersion += 1;
		renderer?.dispose();
		renderer = null;
		initialData = null;
		statusListeners.clear();
	}

	return {
		attach,
		resimulate,
		currentInitialData,
		currentSimParameters,
		getStatus: () => status,
		subscribeStatus(listener) {
			statusListeners.add(listener);
			listener(status);
			return () => statusListeners.delete(listener);
		},
		dispose
	};
}
