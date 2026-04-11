<script lang="ts">
	import { onMount } from 'svelte';
	import { loadTechStack } from '$lib/runtime/tech-stack';

	let hostElement = $state<HTMLDivElement | null>(null);
	let isReady = $state(false);
	let errorMessage = $state('');

	onMount(() => {
		let disposed = false;
		let animationFrame = 0;
		let renderer: any = null;
		let geometry: any = null;
		let material: any = null;
		let edgesGeometry: any = null;
		let edgesMaterial: any = null;
		let resizeObserver: ResizeObserver | null = null;

		void (async () => {
			try {
				const THREE = (await loadTechStack('three')) as any;

				if (disposed || !hostElement) {
					return;
				}

				const scene = new THREE.Scene();
				scene.background = new THREE.Color('#16202f');

				const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
				camera.position.set(1.8, 1.5, 2.9);
				camera.lookAt(0, 0, 0);

				renderer = new THREE.WebGLRenderer({ antialias: false });
				renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
				renderer.shadowMap.enabled = false;
				hostElement.replaceChildren(renderer.domElement as HTMLCanvasElement);

				geometry = new THREE.BoxGeometry(1, 1, 1);
				material = new THREE.MeshStandardMaterial({
					color: '#8f7ff0',
					roughness: 0.6,
					metalness: 0.05
				});

				const cube = new THREE.Mesh(geometry, material);
				scene.add(cube);

				edgesGeometry = new THREE.EdgesGeometry(geometry);
				edgesMaterial = new THREE.LineBasicMaterial({ color: '#f4f0ff' });
				const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
				cube.add(edges);

				const ambientLight = new THREE.AmbientLight('#b8c4ff', 0.7);
				scene.add(ambientLight);

				const keyLight = new THREE.DirectionalLight('#ffffff', 1.15);
				keyLight.position.set(2.5, 3, 4);
				scene.add(keyLight);

				const rimLight = new THREE.DirectionalLight('#7f8cff', 0.4);
				rimLight.position.set(-3, 1.5, -2);
				scene.add(rimLight);

				const resize = () => {
					if (!hostElement || !renderer) {
						return;
					}

					const width = Math.max(hostElement.clientWidth, 1);
					const height = Math.max(hostElement.clientHeight, 1);
					renderer.setSize(width, height, false);
					camera.aspect = width / height;
					camera.updateProjectionMatrix();
				};

				resize();
				resizeObserver = new ResizeObserver(resize);
				resizeObserver.observe(hostElement);

				isReady = true;

				const renderFrame = () => {
					cube.rotation.x += 0.01;
					cube.rotation.y += 0.016;
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