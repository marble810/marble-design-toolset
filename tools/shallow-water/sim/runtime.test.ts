import { expect, test } from 'bun:test';
import type { ContainerSurfaceContext } from '@deshelf/tool-sdk';
import type { AssetContent, ParameterSnapshot } from 'tool-contract';
import { createShallowWaterRuntime } from './runtime.ts';

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void } {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => { resolve = done; });
	return { promise, resolve };
}

async function flush(): Promise<void> {
	await Promise.resolve();
	await Promise.resolve();
}

test('clearing an image asset invalidates an in-flight decode', async () => {
	let asset: AssetContent | null = { kind: 'blob-url', mime: 'image/png', url: 'blob:test' };
	let notifyAsset: (() => void) | undefined;
	const snapshot: ParameterSnapshot = {
		revision: 0,
		values: { sourceMode: 'image' },
		revisions: { sourceMode: 0 }
	};
	const context = {
		parameters: {
			snapshot: () => snapshot,
			subscribe: () => () => {}
		},
		assets: {
			values: () => ({ initMap: asset }),
			subscribe: (listener: () => void) => {
				notifyAsset = listener;
				return () => {};
			}
		},
		setParameter: async () => ({ accepted: true })
	} as unknown as ContainerSurfaceContext;
	const pending = deferred<Float32Array>();
	let committedHeightFields = 0;
	const runtime = createShallowWaterRuntime(context, {
		loadHeightData: () => pending.promise,
		createRenderer: () => ({
			setInitialHeight: () => { committedHeightFields += 1; },
			advanceFrames: () => {},
			render: () => {},
			dispose: () => {}
		}),
		requestFrame: () => 1,
		cancelFrame: () => {}
	});

	runtime.attach({ width: 0, height: 0 } as HTMLCanvasElement);
	await flush();
	asset = null;
	notifyAsset?.();
	await flush();
	pending.resolve(new Float32Array([1]));
	await flush();

	expect(runtime.getStatus().kind).toBe('idle');
	expect(runtime.currentInitialData()).toBeNull();
	expect(committedHeightFields).toBe(0);
	runtime.dispose();
});
