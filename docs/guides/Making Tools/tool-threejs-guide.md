# Making Tools with Three.js

本指南说明如何在 Marble Design Toolset 中编写 Three.js 工具。重点不是 Three.js 本身，而是如何把 WebGL 生命周期接入 framework：tool 只渲染自己的左侧控制与右侧舞台，技术栈加载、session active、导出注册和资源释放都优先复用共享 runtime。

## TL;DR

1. 运行 `bun run create:tool`，选择 `stage` starter，并声明 `three` tech stack。
2. master `.svelte` 只组合 `LeftPanel`、`RightPanel`、`FullStage` 和私有 Three 子组件。
3. Three 子组件使用 `createRenderHostLifecycle()` 与 `createThreeRenderHost(renderHost)`。
4. 渲染循环使用 `renderHost.startAnimationLoop(...)`，隐藏 tab 时会自动暂停。
5. 需要导出时声明 metadata `export` 能力，并用 canvas export runtime 注册 exporter；不要手写下载按钮或文件 IO。

## 目录与 Definition

脚手架会生成符合 contract 的目录：

```text
src/tools/model-viewer/
├── metadata.json
├── index.ts
├── ModelViewer.svelte
└── components/
    └── ModelViewerStage.svelte
```

`index.ts` 中必须声明 Three：

```ts
import metadata from './metadata.json';
import type { ToolDefinition } from '$lib/types/tool';

const definition = {
	metadata,
	techStack: ['three'],
	loadComponent: () => import('./ModelViewer.svelte')
} satisfies ToolDefinition;

export default definition;
```

如果工具需要导出快照或视频，在 `metadata.json` 中声明能力：

```json
{
	"name": "Model Viewer",
	"desc": "Preview a simple Three.js scene.",
	"tag": ["three", "stage"],
	"version": "1.0.0",
	"enabled": true,
	"export": {
		"image": true,
		"video": true
	}
}
```

## Master 组件

master 组件只负责参数状态和 shell 组合。参数型控件优先复用共享 UI 组件，避免每个工具重复写 label、checkbox、field 样式。

```svelte
<script lang="ts">
	import { FullStage, LeftPanel, RightPanel, Section } from '$lib/components/shell/index.js';
	import { CheckboxField, Field } from '$lib/components/ui/index.js';
	import ModelViewerStage from './components/ModelViewerStage.svelte';

	let wireframe = $state(false);
	let autoRotate = $state(true);
	let boxColor = $state('#8f7ff0');
	let keyLightIntensity = $state(1.15);
</script>

<LeftPanel>
	<Section title="Renderer">
		<CheckboxField label="Wireframe" bind:checked={wireframe} />
		<CheckboxField label="Auto Rotate" bind:checked={autoRotate} />
	</Section>

	<Section title="Material" collapsible>
		<Field label="Albedo">
			<input class="pixel-input" type="text" bind:value={boxColor} />
		</Field>
	</Section>

	<Section title="Lighting" collapsible>
		<Field label="Key Light Intensity">
			<input class="pixel-input" type="number" bind:value={keyLightIntensity} step="0.1" min="0" />
		</Field>
	</Section>
</LeftPanel>

<RightPanel>
	<FullStage>
		<ModelViewerStage {wireframe} {autoRotate} {boxColor} {keyLightIntensity} />
	</FullStage>
</RightPanel>
```

## Three 子组件

Three 子组件持有 WebGL 资源。推荐使用 render host lifecycle 管理初始化状态、错误、cleanup、animation loop 和 exporter 注销。

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import {
		createRenderHostLifecycle,
		createThreeRenderHost
	} from '$lib/runtime/render-host/index.js';

	interface Props {
		wireframe: boolean;
		autoRotate: boolean;
		boxColor: string;
		keyLightIntensity: number;
	}

	let { wireframe, autoRotate, boxColor, keyLightIntensity }: Props = $props();

	const renderHost = createRenderHostLifecycle();
	let hostElement = $state<HTMLDivElement | null>(null);
	const isReady = $derived(renderHost.isReady);
	const errorMessage = $derived(renderHost.errorMessage);

	let renderer: { domElement: HTMLCanvasElement; render(scene: unknown, camera: unknown): void; setPixelRatio(value: number): void; setSize(width: number, height: number, updateStyle?: boolean): void; dispose(): void } | null = null;
	let material: { wireframe: boolean; color: { set(value: string): void }; dispose(): void } | null = null;
	let keyLight: { intensity: number; position: { set(x: number, y: number, z: number): void } } | null = null;
	let cube: { rotation: { x: number; y: number } } | null = null;
	let scene: unknown = null;
	let camera: { aspect: number; updateProjectionMatrix(): void; position: { set(x: number, y: number, z: number): void }; lookAt(x: number, y: number, z: number): void } | null = null;

	$effect(() => {
		if (!isReady || !material) return;
		material.wireframe = wireframe;
		material.color.set(boxColor);
	});

	$effect(() => {
		if (!isReady || !keyLight) return;
		keyLight.intensity = keyLightIntensity;
	});

	onMount(() => {
		void renderHost.runInit(async () => {
			if (!hostElement) {
				throw new Error('Three host is unavailable.');
			}

			const { THREE } = await createThreeRenderHost(renderHost);

			scene = new THREE.Scene();
			scene.background = new THREE.Color('#16202f');

			camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
			camera.position.set(1.8, 1.5, 2.9);
			camera.lookAt(0, 0, 0);

			renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
			renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
			hostElement.replaceChildren(renderer.domElement);

			const geometry = new THREE.BoxGeometry(1, 1, 1);
			material = new THREE.MeshStandardMaterial({ color: boxColor, wireframe, roughness: 0.6 });
			cube = new THREE.Mesh(geometry, material);
			scene.add(cube);

			keyLight = new THREE.DirectionalLight('#ffffff', keyLightIntensity);
			keyLight.position.set(2.5, 3, 4);
			scene.add(new THREE.AmbientLight('#b8c4ff', 0.7));
			scene.add(keyLight);

			const resize = () => {
				if (!hostElement || !renderer || !camera) return;
				const width = Math.max(hostElement.clientWidth, 1);
				const height = Math.max(hostElement.clientHeight, 1);
				renderer.setSize(width, height, false);
				camera.aspect = width / height;
				camera.updateProjectionMatrix();
			};

			resize();
			const resizeObserver = new ResizeObserver(resize);
			resizeObserver.observe(hostElement);

			renderHost.addCleanup(() => resizeObserver.disconnect());
			renderHost.addCleanup(() => geometry.dispose());
			renderHost.addCleanup(() => material?.dispose());
			renderHost.addCleanup(() => renderer?.dispose());
			renderHost.addCleanup(() => hostElement?.replaceChildren());

			renderHost.registerCanvasExporter(
				{
					kind: 'canvas',
					get contentWidth() { return renderer?.domElement.width ?? 1; },
					get contentHeight() { return renderer?.domElement.height ?? 1; },
					getCanvas: () => {
						if (renderer && scene && camera) {
							renderer.render(scene, camera);
						}
						return renderer?.domElement ?? null;
					}
				},
				{ id: 'three-stage', label: 'Three Stage' }
			);

			renderHost.startAnimationLoop(() => {
				if (!renderer || !scene || !camera || !cube) return;
				if (autoRotate) {
					cube.rotation.x += 0.01;
					cube.rotation.y += 0.016;
				}
				renderer.render(scene, camera);
			});
		}, 'Failed to initialize Three.js.');
	});
</script>

<div class="model-viewer-stage">
	<div class="model-viewer-stage__host" bind:this={hostElement}></div>

	{#if !isReady && !errorMessage}
		<div class="model-viewer-stage__overlay">Booting Three.js...</div>
	{/if}

	{#if errorMessage}
		<div class="model-viewer-stage__overlay model-viewer-stage__overlay--error">{errorMessage}</div>
	{/if}
</div>

<style>
	.model-viewer-stage {
		position: absolute;
		inset: 0;
	}

	.model-viewer-stage__host {
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	.model-viewer-stage__overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #090d16;
		color: var(--color-fg-secondary);
	}

	.model-viewer-stage__overlay--error {
		color: var(--color-danger);
	}
</style>
```

## 导出

导出由 framework 的 Canvas Export Section 负责。Three tool 不应该自己创建按钮、Blob URL、下载链接或文件名。推荐流程：

- `metadata.json` 声明 `export.image` / `export.video`。
- Three 子组件用 `renderHost.registerCanvasExporter(...)` 或 `getCanvasExportContext().register(...)` 注册 exporter。
- `getCanvas()` 中可以先 `renderer.render(scene, camera)`，确保抓取当前帧。
- WebGL canvas 如需稳定快照，`WebGLRenderer` 可设置 `preserveDrawingBuffer: true`。

如果工具需要确定性视频帧，优先注册 `kind: 'render'` exporter，用 `renderFrame({ canvas, time, frameIndex })` 在 framework 提供的离屏 canvas 上重放场景。

## 最佳实践

- Three.js 工具应使用 `FullStage`，不要放进固定尺寸的 `PreviewCanvas`。
- `$effect` 只同步已存在对象的参数，不要在 effect 里重建 renderer、scene 或材质。
- 所有手动创建的几何体、材质、纹理和 renderer 都必须注册 cleanup。
- 长时间运行的动画、ticker 或模拟循环使用 `renderHost.startAnimationLoop(...)`，让 hidden tab 自动暂停。
- 多 exporter 工具必须为每个 exporter 传稳定 `{ id, label }`，让 Export Section 的 selector 保持稳定。
