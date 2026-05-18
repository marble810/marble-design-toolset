import { onDestroy } from 'svelte';
import {
	getCanvasExportContext,
	registerCanvasExporterForLifecycle
} from '$lib/runtime/canvas-export/context';
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

export type ToolHostLifecycleStatus = 'initializing' | 'ready' | 'error' | 'disposed';
export type ToolHostLifecycleActivity = 'active' | 'inactive';

export interface ToolHostLifecycleOptions {
	scheduler?: AnimationScheduler;
}

export interface ToolHostLifecycle {
	readonly status: ToolHostLifecycleStatus;
	readonly activity: ToolHostLifecycleActivity;
	readonly isReady: boolean;
	readonly errorMessage: string;
	readonly isDisposed: boolean;
	readonly isSessionActive: boolean;
	readonly core: RenderHostLifecycleCore;
	setReady: (ready?: boolean) => void;
	setError: (error: unknown, fallbackMessage: string) => void;
	runInit: (init: () => void | Promise<void>, fallbackMessage: string) => Promise<void>;
	addCleanup: (cleanup: () => void) => () => void;
	onActiveChange: (callback: (active: boolean) => void) => () => void;
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

export function createToolHostLifecycle(
	options: ToolHostLifecycleOptions = {}
): ToolHostLifecycle {
	const toolSessionContext = getToolSessionContext();
	const exportContext = getCanvasExportContext();
	let isReady = $state(false);
	let errorMessage = $state('');
	let isSessionActive = $state(toolSessionContext?.isActive() ?? true);

	const core = createRenderHostLifecycleCore({
		isActive: () => toolSessionContext?.isActive() ?? true,
		subscribeActive: toolSessionContext?.onActiveChange,
		scheduler: options.scheduler
	});

	core.onActiveChange((active) => {
		isSessionActive = active;
	});
	onDestroy(() => core.dispose());

	function setReady(ready = true): void {
		if (core.isDisposed) return;
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
			setReady(true);
		} catch (error) {
			setError(error, fallbackMessage);
		}
	}

	function registerCanvasExporter(
		descriptor: CanvasExporterCanvas,
		registrationOptions?: CanvasExporterRegistrationOptions
	): () => void {
		return registerCanvasExporterForLifecycle(
			exportContext,
			descriptor,
			core.addCleanup,
			registrationOptions
		);
	}

	function registerRenderExporter(
		descriptor: CanvasExporterRender,
		registrationOptions?: CanvasExporterRegistrationOptions
	): () => void {
		return registerCanvasExporterForLifecycle(
			exportContext,
			descriptor,
			core.addCleanup,
			registrationOptions
		);
	}

	return {
		get status() {
			if (core.isDisposed) return 'disposed';
			if (errorMessage) return 'error';
			return isReady ? 'ready' : 'initializing';
		},
		get activity() {
			return isSessionActive ? 'active' : 'inactive';
		},
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
			return isSessionActive;
		},
		core,
		setReady,
		setError,
		runInit,
		addCleanup: core.addCleanup,
		onActiveChange: core.onActiveChange,
		registerCanvasExporter,
		registerRenderExporter,
		dispose: core.dispose
	};
}
