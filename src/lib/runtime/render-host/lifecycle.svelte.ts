import { onDestroy } from 'svelte';
import { getCanvasExportContext } from '$lib/runtime/canvas-export/context';
import { getToolSessionContext } from '$lib/runtime/tool-session-context';
import type {
	CanvasExporterCanvas,
	CanvasExporterRegistrationOptions,
	CanvasExporterRender
} from '$lib/types/canvas-export';
import {
	createRenderHostLifecycleCore,
	type AnimationScheduler,
	type RenderHostLifecycleCore
} from './lifecycle-core.js';

export interface RenderHostLifecycleOptions {
	scheduler?: AnimationScheduler;
}

export interface RenderHostLifecycle {
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
	const toolSessionContext = getToolSessionContext();
	const exportContext = getCanvasExportContext();
	let isReady = $state(false);
	let errorMessage = $state('');

	const core = createRenderHostLifecycleCore({
		isActive: () => toolSessionContext?.isActive() ?? true,
		scheduler: options.scheduler
	});

	onDestroy(() => core.dispose());

	function setReady(ready = true): void {
		isReady = ready;
		if (ready) errorMessage = '';
	}

	function setError(error: unknown, fallbackMessage: string): void {
		if (core.isDisposed) return;
		isReady = false;
		errorMessage = error instanceof Error ? error.message : fallbackMessage;
	}

	async function runInit(init: () => void | Promise<void>, fallbackMessage: string): Promise<void> {
		try {
			await init();
			if (!core.isDisposed) setReady(true);
		} catch (error) {
			setError(error, fallbackMessage);
		}
	}

	function registerCanvasExporter(
		descriptor: CanvasExporterCanvas,
		registrationOptions?: CanvasExporterRegistrationOptions
	): () => void {
		const unregister = exportContext?.register(descriptor, registrationOptions) ?? (() => {});
		return core.addCleanup(unregister);
	}

	function registerRenderExporter(
		descriptor: CanvasExporterRender,
		registrationOptions?: CanvasExporterRegistrationOptions
	): () => void {
		const unregister = exportContext?.register(descriptor, registrationOptions) ?? (() => {});
		return core.addCleanup(unregister);
	}

	return {
		get isReady() {
			return isReady;
		},
		get errorMessage() {
			return errorMessage;
		},
		get isDisposed() {
			return core.isDisposed;
		},
		get isSessionActive() {
			return core.isActive;
		},
		core,
		setReady,
		setError,
		runInit,
		addCleanup: core.addCleanup,
		startAnimationLoop: core.startAnimationLoop,
		registerCanvasExporter,
		registerRenderExporter,
		dispose: core.dispose
	};
}