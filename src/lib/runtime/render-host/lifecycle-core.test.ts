import assert from 'node:assert/strict';
import test from 'node:test';

import { createRenderHostLifecycleCore, type AnimationScheduler } from './lifecycle-core.ts';

test('render host lifecycle runs animation callbacks only while active', () => {
	let active = true;
	const scheduler = createManualScheduler();
	const lifecycle = createRenderHostLifecycleCore({ isActive: () => active, scheduler });
	let frames = 0;

	lifecycle.startAnimationLoop(() => {
		frames += 1;
	});

	scheduler.tick(1);
	active = false;
	scheduler.tick(2);
	active = true;
	scheduler.tick(3);

	assert.equal(frames, 2);
});

test('render host lifecycle disposes cleanups in reverse order and cancels animation', () => {
	const scheduler = createManualScheduler();
	const lifecycle = createRenderHostLifecycleCore({ scheduler });
	const calls: string[] = [];

	lifecycle.addCleanup(() => calls.push('first'));
	lifecycle.addCleanup(() => calls.push('second'));
	lifecycle.startAnimationLoop(() => calls.push('frame'));
	lifecycle.dispose();
	scheduler.tick(1);
	lifecycle.dispose();

	assert.equal(lifecycle.isDisposed, true);
	assert.deepEqual(calls, ['second', 'first']);
});

function createManualScheduler(): AnimationScheduler & { tick: (time: number) => void } {
	let nextHandle = 0;
	let callback: FrameRequestCallback | null = null;

	return {
		request: (nextCallback) => {
			nextHandle += 1;
			callback = nextCallback;
			return nextHandle;
		},
		cancel: () => {
			callback = null;
		},
		tick: (time) => {
			const nextCallback = callback;
			callback = null;
			nextCallback?.(time);
		}
	};
}