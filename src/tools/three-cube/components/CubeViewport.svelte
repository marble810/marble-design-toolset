<script lang="ts">
	import { onMount } from 'svelte';
	import { loadTechStack } from '$lib/runtime/tech-stack';
	import type { TechStackModule } from '$lib/types/tech-stack';
	import { getCanvasExportContext } from '$lib/runtime/canvas-export/context';

	type ThreeModule = TechStackModule<'three'>;
	type DisposableHandle = {
		dispose(): void;
	};
	type CameraHandle = {
		position: { set(x: number, y: number, z: number): void };
		lookAt(x: number, y: number, z: number): void;
		aspect: number;
		updateProjectionMatrix(): void;
	};
	type RendererHandle = DisposableHandle & {
		domElement: HTMLCanvasElement;
		shadowMap: { enabled: boolean };
		render(scene: unknown, camera: unknown): void;
		setPixelRatio(nextPixelRatio: number): void;
		setSize(width: number, height: number, updateStyle?: boolean): void;
	};
	type SceneHandle = {
		background: unknown;
		add(object: unknown): void;
	};
	type MeshHandle = {
		add(object: unknown): void;
		rotation: { x: number; y: number };
	};
	type LightHandle = {
		position: { set(x: number, y: number, z: number): void };
	};

	let hostElement = $state<HTMLDivElement | null>(null);
	let isReady = $state(false);
	let errorMessage = $state('');

	// Must be read during component initialization (Svelte 5 getContext rule),
	// not inside the async IIFE in onMount.
	const exportContext = getCanvasExportContext();

	onMount(() => {
		let disposed = false;
		let animationFrame = 0;
		let renderer: RendererHandle | null = null;
		let geometry: DisposableHandle | null = null;
		let material: DisposableHandle | null = null;
		let edgesGeometry: DisposableHandle | null = null;
		let edgesMaterial: DisposableHandle | null = null;
		let resizeObserver: ResizeObserver | null = null;
		let unregisterExporter: (() => void) | null = null;

		void (async () => {
			try {
				const THREE: ThreeModule = await loadTechStack('three');

				if (disposed || !hostElement) {
					return;
				}

				const scene = new THREE.Scene();
				const sceneHandle = scene as unknown as SceneHandle;
				sceneHandle.background = new THREE.Color('#16202f');

				const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
				const cameraHandle = camera as unknown as CameraHandle;
				cameraHandle.position.set(1.8, 1.5, 2.9);
				cameraHandle.lookAt(0, 0, 0);

				renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true }) as unknown as RendererHandle;
				renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
				renderer.shadowMap.enabled = false;
				hostElement.replaceChildren(renderer.domElement as HTMLCanvasElement);

				const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
				const meshMaterial = new THREE.MeshStandardMaterial({
					color: '#8f7ff0',
					roughness: 0.6,
					metalness: 0.05
				});
				geometry = boxGeometry;
				material = meshMaterial;

				const cube = new THREE.Mesh(boxGeometry, meshMaterial);
				const cubeHandle = cube as unknown as MeshHandle;
				sceneHandle.add(cube);

				const cubeEdgesGeometry = new THREE.EdgesGeometry(boxGeometry);
				const cubeEdgesMaterial = new THREE.LineBasicMaterial({ color: '#f4f0ff' });
				edgesGeometry = cubeEdgesGeometry;
				edgesMaterial = cubeEdgesMaterial;
				const edges = new THREE.LineSegments(cubeEdgesGeometry, cubeEdgesMaterial);
				cubeHandle.add(edges);

				const ambientLight = new THREE.AmbientLight('#b8c4ff', 0.7);
				sceneHandle.add(ambientLight);

				const keyLight = new THREE.DirectionalLight('#ffffff', 1.15);
				const keyLightHandle = keyLight as unknown as LightHandle;
				keyLightHandle.position.set(2.5, 3, 4);
				sceneHandle.add(keyLight);

				const rimLight = new THREE.DirectionalLight('#7f8cff', 0.4);
				const rimLightHandle = rimLight as unknown as LightHandle;
				rimLightHandle.position.set(-3, 1.5, -2);
				sceneHandle.add(rimLight);

				const resize = () => {
					if (!hostElement || !renderer) {
						return;
					}

					const width = Math.max(hostElement.clientWidth, 1);
					const height = Math.max(hostElement.clientHeight, 1);
					renderer.setSize(width, height, false);
					cameraHandle.aspect = width / height;
					cameraHandle.updateProjectionMatrix();
				};

				resize();
				resizeObserver = new ResizeObserver(resize);
				resizeObserver.observe(hostElement);

				isReady = true;

				if (exportContext && renderer) {
					const rendererRef = renderer;
					unregisterExporter = exportContext.register({
						kind: 'canvas',
						get contentWidth() {
							return (rendererRef.domElement as HTMLCanvasElement).width;
						},
						get contentHeight() {
							return (rendererRef.domElement as HTMLCanvasElement).height;
						},
						getCanvas: () => {
							// Force a fresh render so the buffer is current at capture time.
							rendererRef.render(scene, camera);
							return rendererRef.domElement as HTMLCanvasElement;
						}
					});
				}

				const renderFrame = () => {
					cubeHandle.rotation.x += 0.01;
					cubeHandle.rotation.y += 0.016;
					renderer?.render(scene, camera);
					animationFrame = window.requestAnimationFrame(renderFrame);
				};

				renderFrame();
			} catch (error) {
				errorMessage = error instanceof Error ? error.message : 'Failed to initialize Three.js.';
			}
		})();

		return () => {
			disposed = true;
			unregisterExporter?.();
			window.cancelAnimationFrame(animationFrame);
			resizeObserver?.disconnect();
			geometry?.dispose();
			material?.dispose();
			edgesGeometry?.dispose();
			edgesMaterial?.dispose();
			renderer?.dispose();
			hostElement?.replaceChildren();
		};
	});
</script>

<div class="cube-viewport">
	<div class="cube-viewport__stage" bind:this={hostElement}></div>

	{#if !isReady && !errorMessage}
		<div class="cube-viewport__overlay">Booting Three.js...</div>
	{/if}

	{#if errorMessage}
		<div class="cube-viewport__overlay cube-viewport__overlay--error">{errorMessage}</div>
	{/if}
</div>

<style>
	.cube-viewport {
		position: relative;
		width: 100%;
		height: 100%;
		border: 2px solid rgba(143, 127, 240, 0.56);
		background: #16202f;
		box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.04);
		overflow: hidden;
	}

	.cube-viewport__stage {
		width: 100%;
		height: 100%;
	}

	.cube-viewport__stage :global(canvas) {
		display: block;
		width: 100%;
		height: 100%;
		image-rendering: pixelated;
	}

	.cube-viewport__overlay {
		position: absolute;
		left: 16px;
		bottom: 16px;
		display: inline-flex;
		align-items: center;
		height: 22px;
		padding: 0 var(--space-2);
		border: 1px solid rgba(255, 255, 255, 0.12);
		background: rgba(9, 13, 22, 0.78);
		color: var(--color-fg-secondary);
		font-size: var(--font-size-1);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.cube-viewport__overlay--error {
		border-color: rgba(255, 107, 129, 0.44);
		color: #ffd4db;
	}
</style>