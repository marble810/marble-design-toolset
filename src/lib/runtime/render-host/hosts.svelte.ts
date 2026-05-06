import { loadTechStack } from '$lib/runtime/tech-stack';
import type { Application, ApplicationOptions } from 'pixi.js';
import type { RenderHostLifecycle } from './lifecycle.svelte.js';

export interface Canvas2DRenderHostOptions {
	width: number;
	height: number;
	willReadFrequently?: boolean;
}

export interface Canvas2DRenderHost {
	canvas: HTMLCanvasElement;
	context: CanvasRenderingContext2D;
	resize: (width: number, height: number) => void;
}

export interface PixiApplicationHostOptions {
	hostElement: HTMLElement;
	init: Partial<ApplicationOptions>;
}

export interface PixiApplicationHost {
	PIXI: Awaited<ReturnType<typeof loadTechStack<'pixi'>>>;
	app: Application;
	canvas: HTMLCanvasElement;
}

export interface ThreeRenderHost {
	THREE: Awaited<ReturnType<typeof loadTechStack<'three'>>>;
	trackDisposable: (disposable: { dispose: () => void }) => () => void;
}

export function createCanvas2DRenderHost(
	lifecycle: RenderHostLifecycle,
	options: Canvas2DRenderHostOptions
): Canvas2DRenderHost {
	const canvas = document.createElement('canvas');
	canvas.width = options.width;
	canvas.height = options.height;
	const context = canvas.getContext('2d', { willReadFrequently: options.willReadFrequently ?? false });
	if (!context) {
		throw new Error('Failed to acquire a 2D render context.');
	}

	lifecycle.addCleanup(() => {
		canvas.width = 0;
		canvas.height = 0;
		canvas.remove();
	});

	return {
		canvas,
		context,
		resize: (width, height) => {
			canvas.width = width;
			canvas.height = height;
		}
	};
}

export async function createPixiApplicationHost(
	lifecycle: RenderHostLifecycle,
	options: PixiApplicationHostOptions
): Promise<PixiApplicationHost> {
	const PIXI = await loadTechStack('pixi');
	const app = new PIXI.Application();
	await app.init(options.init);

	if (lifecycle.isDisposed) {
		app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true, context: true });
		throw new Error('Render host was disposed before Pixi initialized.');
	}

	options.hostElement.replaceChildren(app.canvas);
	lifecycle.addCleanup(() => {
		app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true, context: true });
		options.hostElement.replaceChildren();
	});

	return {
		PIXI,
		app,
		canvas: app.canvas as HTMLCanvasElement
	};
}

export async function createThreeRenderHost(lifecycle: RenderHostLifecycle): Promise<ThreeRenderHost> {
	const THREE = await loadTechStack('three');
	return {
		THREE,
		trackDisposable: (disposable) => lifecycle.addCleanup(() => disposable.dispose())
	};
}