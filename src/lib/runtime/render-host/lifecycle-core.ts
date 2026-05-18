export interface AnimationScheduler {
	request: (callback: FrameRequestCallback) => number;
	cancel: (handle: number) => void;
}

export interface RenderHostLifecycleCoreOptions {
	isActive?: () => boolean;
	subscribeActive?: (callback: (active: boolean) => void) => () => void;
	scheduler?: AnimationScheduler;
}

export interface RenderHostLifecycleCore {
	readonly isDisposed: boolean;
	readonly isActive: boolean;
	addCleanup: (cleanup: () => void) => () => void;
	onActiveChange: (callback: (active: boolean) => void) => () => void;
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
	let currentActive = isActive();
	const cleanups: Array<() => void> = [];
	const activeListeners = new Set<(active: boolean) => void>();

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

	const unsubscribeActive =
		options.subscribeActive?.((active) => {
			if (disposed || active === currentActive) return;
			currentActive = active;
			for (const listener of [...activeListeners]) {
				listener(active);
			}
		}) ?? null;

	if (unsubscribeActive) {
		addCleanup(unsubscribeActive);
	}

	function readActive(): boolean {
		return unsubscribeActive ? currentActive : isActive();
	}

	function onActiveChange(callback: (active: boolean) => void): () => void {
		activeListeners.add(callback);
		callback(readActive());

		return addCleanup(() => {
			activeListeners.delete(callback);
		});
	}

	function startAnimationLoop(callback: FrameRequestCallback): () => void {
		let frame = 0;
		let stopped = false;

		function tick(time: number) {
			if (disposed || stopped) return;
			if (readActive()) {
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
			return readActive();
		},
		addCleanup,
		onActiveChange,
		startAnimationLoop,
		dispose
	};
}