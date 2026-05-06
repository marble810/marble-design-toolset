export interface AnimationScheduler {
	request: (callback: FrameRequestCallback) => number;
	cancel: (handle: number) => void;
}

export interface RenderHostLifecycleCoreOptions {
	isActive?: () => boolean;
	scheduler?: AnimationScheduler;
}

export interface RenderHostLifecycleCore {
	readonly isDisposed: boolean;
	readonly isActive: boolean;
	addCleanup: (cleanup: () => void) => () => void;
	startAnimationLoop: (callback: FrameRequestCallback) => () => void;
	dispose: () => void;
}

const browserAnimationScheduler: AnimationScheduler = {
	request: (callback) => requestAnimationFrame(callback),
	cancel: (handle) => cancelAnimationFrame(handle)
};

export function createRenderHostLifecycleCore(
	options: RenderHostLifecycleCoreOptions = {}
): RenderHostLifecycleCore {
	const isActive = options.isActive ?? (() => true);
	const scheduler = options.scheduler ?? browserAnimationScheduler;
	let disposed = false;
	const cleanups: Array<() => void> = [];

	function addCleanup(cleanup: () => void): () => void {
		if (disposed) {
			cleanup();
			return () => {};
		}

		cleanups.push(cleanup);
		let active = true;
		return () => {
			if (!active) return;
			active = false;
			const index = cleanups.indexOf(cleanup);
			if (index >= 0) cleanups.splice(index, 1);
			cleanup();
		};
	}

	function startAnimationLoop(callback: FrameRequestCallback): () => void {
		let frame = 0;
		let stopped = false;

		function tick(time: number) {
			if (disposed || stopped) return;
			if (isActive()) {
				callback(time);
			}
			frame = scheduler.request(tick);
		}

		frame = scheduler.request(tick);
		return addCleanup(() => {
			stopped = true;
			scheduler.cancel(frame);
		});
	}

	function dispose(): void {
		if (disposed) return;
		disposed = true;

		for (const cleanup of [...cleanups].reverse()) {
			cleanup();
		}
		cleanups.length = 0;
	}

	return {
		get isDisposed() {
			return disposed;
		},
		get isActive() {
			return isActive();
		},
		addCleanup,
		startAnimationLoop,
		dispose
	};
}