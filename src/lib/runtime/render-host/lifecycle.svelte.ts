import type {
	CanvasExporterCanvas,
	CanvasExporterRegistrationOptions,
	CanvasExporterRender
} from '$lib/types/canvas-export';
import {
	createToolHostLifecycle,
	type ToolHostLifecycle,
	type ToolHostLifecycleOptions
} from './host-lifecycle.svelte.js';
import type { AnimationScheduler, RenderHostLifecycleCore } from './lifecycle-core.js';

export interface RenderHostLifecycleOptions extends ToolHostLifecycleOptions {
	scheduler?: AnimationScheduler;
}

export interface RenderHostLifecycle extends ToolHostLifecycle {
	readonly isReady: boolean;
	readonly errorMessage: string;
	readonly isDisposed: boolean;
	readonly isSessionActive: boolean;
	readonly core: RenderHostLifecycleCore;
	setReady: (ready?: boolean) => void;
	setError: (error: unknown, fallbackMessage: string) => void;
	runInit: (init: () => void | Promise<void>, fallbackMessage: string) => Promise<void>;
	addCleanup: (cleanup: () => void) => () => void;
	startAnimationLoop: (callback: FrameRequestCallback) => () => void;
	registerCanvasExporter: (
		descriptor: CanvasExporterCanvas,
		options?: CanvasExporterRegistrationOptions
	) => () => void;
	registerRenderExporter: (
		descriptor: CanvasExporterRender,
		options?: CanvasExporterRegistrationOptions
	) => () => void;
	dispose: () => void;
}

export function createRenderHostLifecycle(
	options: RenderHostLifecycleOptions = {}
): RenderHostLifecycle {
	const hostLifecycle = createToolHostLifecycle(options);

	return {
		get status() {
			return hostLifecycle.status;
		},
		get activity() {
			return hostLifecycle.activity;
		},
		get isReady() {
			return hostLifecycle.isReady;
		},
		get errorMessage() {
			return hostLifecycle.errorMessage;
		},
		get isDisposed() {
			return hostLifecycle.isDisposed;
		},
		get isSessionActive() {
			return hostLifecycle.isSessionActive;
		},
		core: hostLifecycle.core,
		setReady: hostLifecycle.setReady,
		setError: hostLifecycle.setError,
		runInit: hostLifecycle.runInit,
		addCleanup: hostLifecycle.addCleanup,
		onActiveChange: hostLifecycle.onActiveChange,
		startAnimationLoop: hostLifecycle.core.startAnimationLoop,
		registerCanvasExporter: hostLifecycle.registerCanvasExporter,
		registerRenderExporter: hostLifecycle.registerRenderExporter,
		dispose: hostLifecycle.dispose
	};
}