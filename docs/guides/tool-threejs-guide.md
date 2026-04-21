# 在 Marble Design Toolset 中创建基于 Three.js 的 Tool

本指南将带你从零开始，在 **Marble Design Toolset** 中创建一个基于 **Three.js** 的 3D 模型预览/编辑工具。我们将学习如何配置参数区、如何使用 `FullStage` 作为 3D 渲染器的无边距宿主、如何绑定渲染循环与调整参数，以及最终实现设置传递和实时预览效果同步更新。

## 适用场景

Three.js 非常适合构建 3D 场景查看器、材质编辑器、网格生成器等工具。在本框架中，3D 工具通常希望占据整个右侧舞台、不被 `PreviewCanvas` 的 2D 比例限制（而是自适应面板剩余宽高）。这就必须用 `FullStage` 容器来包裹。

---

## 1. 使用脚手架初始化目录

最好从脚手架开始创建我们的基础骨架。

```bash
bun run create:tool
```

交互过程：
- **Tool Name**: `Model Viewer` (自动转成 `model-viewer`)
- **Starter Type**: `stage` (我们需要 WebGL 的全出血视口自适应，而不是固定长宽的画板)
- **Tech Stacks**: `three` (框架提供全局的三方包并加载之)

此时，你会在 `src/tools/model-viewer/` 下得到预置内容。主文件为 `ModelViewer.svelte`，配套渲染器子组件可能叫 `StageViewport.svelte`，在 `index.ts` 里一定声明了：

```typescript
import metadata from './metadata.json';
import type { ToolDefinition } from '$lib/types/tool';

const definition = {
	metadata,
	techStack: ['three'],
	loadComponent: () => import('./ModelViewer.svelte')
} satisfies ToolDefinition;

export default definition;
```

---

## 2. 状态映射与组件拆解

3D 工具的主要分工：
1. 主组件负责 `LeftPanel`、定义**光照**、**网格颜色**、**网格可见性**等 `$state` 参数。负责将参数通过 props 推入到专门的 3D 场景组件内。
2. 内部组件挂载 `<div class="viewport">`。它订阅挂载宿主的 ResizeObserver，自适应宽高等比投影，并在渲染循环和 `$effect` 中实时反馈左侧面板传来的设定。

---

## 3. 编写主组件 (ModelViewer.svelte)

在根组件里我们来定义所需的参数字段，把它们传给内部负责跑 Three 实例的子组件：

```svelte
<script lang="ts">
	import { LeftPanel, FullStage, RightPanel, Section } from '$lib/components/shell/index.js';
	// 从脚手架生成或自己建立在 components 目录下
	import StageViewport from './components/StageViewport.svelte';

	// ==========================================
	// 状态：我们要传递给 3D 场景的参数
	// ==========================================
	let wireframe = $state(false);
	let autoRotate = $state(true);
	let boxColor = $state('#8f7ff0');
	let keyLightIntensity = $state(1.15);

	let downloadTrigger = $state(0);

	function triggerDownload() {
		downloadTrigger++;
	}
</script>

<LeftPanel>
	<Section title="Renderer Mode">
		<label class="model-viewer__field">
			<!-- 不使用 form，只要 input 配合绑定即可 -->
			<span class="model-viewer__caption">Wireframe</span>
			<input class="pixel-checkbox" type="checkbox" bind:checked={wireframe} />
		</label>
	</Section>
	
	<Section title="Mesh Settings">
		<label class="model-viewer__field">
			<span class="model-viewer__caption">Albedo</span>
			<input class="pixel-input" type="text" bind:value={boxColor} />
		</label>
		<label class="model-viewer__field">
			<span class="model-viewer__caption">Auto Rotate</span>
			<input class="pixel-checkbox" type="checkbox" bind:checked={autoRotate} />
		</label>
	</Section>

	<Section title="Lighting">
		<label class="model-viewer__field">
			<span class="model-viewer__caption">Key Light Intensity</span>
			<input class="pixel-input" type="number" bind:value={keyLightIntensity} step="0.1" min="0" />
		</label>
	</Section>

	<Section title="Actions" collapsible>
		<!-- 预备好的一个导出动作，框架建议优先引入 Buttons -->
		<button class="pixel-button" onclick={triggerDownload}>Snapshot Image</button>
	</Section>
</LeftPanel>

<RightPanel>
	<FullStage>
		<!-- 3D 舞台，把参数以 Prop 形式统统砸给内部组件，内部用 effect 去应用 -->
		<StageViewport 
			{wireframe} 
			{autoRotate} 
			{boxColor} 
			{keyLightIntensity} 
			{downloadTrigger} 
		/>
	</FullStage>
</RightPanel>

<style>
	/* 同架构指导书：使用共享的 CSS 自定义属性 */
	.model-viewer__field { display: flex; flex-direction: column; gap: var(--space-2); margin-bottom: var(--space-4); }
	.model-viewer__caption { color: var(--color-fg-secondary); font-size: var(--font-size-1); letter-spacing: 0.08em; text-transform: uppercase; }
	.pixel-button { padding: var(--space-2) var(--space-4); background: var(--color-bg-surface); color: var(--color-bg-primary); border: 1px solid var(--color-border); cursor: pointer; }
</style>
```

---

## 4. 接入 ThreeJS 舞台容器 (StageViewport.svelte)

由于是自适应，且需要控制 WebGL Context，这里面的生命周期至关重要：
- onMount 中发起 `loadTechStack`
- 建立摄像机、光照、网格、材质等全局变量，便于后边 `$effect` 去更新
- 执行自适应并绑定 `ResizeObserver`
- **挂载请求帧 `requestAnimationFrame`**
- **通过 `$effect` 自动同步**
- **返回妥善清理的卸载函数**

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	// 从运行时获取加载器
	import { loadTechStack } from '$lib/runtime/tech-stack';

	interface Props {
		wireframe: boolean;
		autoRotate: boolean;
		boxColor: string;
		keyLightIntensity: number;
		downloadTrigger: number;
	}
	let { wireframe, autoRotate, boxColor, keyLightIntensity, downloadTrigger }: Props = $props();

	let hostElement = $state<HTMLDivElement | null>(null);
	let isReady = $state(false);
	let errorMessage = $state('');

	// 记录 Three 的持久层实例
	let renderer: any = null;
	let material: any = null;
	let keyLight: any = null;
	let cube: any = null;
	let scene: any = null;
	let camera: any = null;

	// ==========================================
	// 使用 $effect 实现单向数据流与材质同步
	// ==========================================
	$effect(() => {
		if (!isReady || !material) return;
		material.wireframe = wireframe;
	});

	$effect(() => {
		// 三个等号同步色彩，这里我们需要调一下 Three 的颜色更新，以规避无效对象
		if (!isReady || !material) return;
		// 需注意：如果有 ThreeJS 对象引用问题，可以按官方约定
		material.color.set(boxColor);
	});

	$effect(() => {
		if (!isReady || !keyLight) return;
		keyLight.intensity = keyLightIntensity;
	});

	$effect(() => {
		if (!isReady || downloadTrigger === 0 || !renderer) return;

		const dataURL = renderer.domElement.toDataURL('image/png');
		const a = document.createElement('a');
		a.href = dataURL;
		a.download = 'model-snapshot.png';
		a.click();
	});

	onMount(() => {
		let disposed = false;
		let animationFrame = 0;
		let resizeObserver: ResizeObserver | null = null;
		
		// 持久几何体与光照声明，用于销毁
		let geometry: any = null;

		void (async () => {
			try {
				// 获取由 loadTechStacks 自动预加载好的缓冲中的 THREE 对象
				const THREE = (await loadTechStack('three')) as typeof import('three');

				if (disposed || !hostElement) return;

				// 1. 初始化场景与相机
				scene = new THREE.Scene();
				scene.background = new THREE.Color('#16202f');

				camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
				camera.position.set(1.8, 1.5, 2.9);
				camera.lookAt(0, 0, 0);

				// 2. 初始化渲染器
				renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true }); // 需要抽样抓图就得给 preserveDrawingBuffer: true
				renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
				
				// 附加画布到我们的响应区：
				hostElement.replaceChildren(renderer.domElement as HTMLCanvasElement);

				// 3. 构建网格
				geometry = new THREE.BoxGeometry(1, 1, 1);
				material = new THREE.MeshStandardMaterial({
					color: boxColor, 
					wireframe: wireframe,
					roughness: 0.6,
					metalness: 0.05
				});
				cube = new THREE.Mesh(geometry, material);
				scene.add(cube);

				// 4. 重光照布置
				const ambientLight = new THREE.AmbientLight('#b8c4ff', 0.7);
				scene.add(ambientLight);

				keyLight = new THREE.DirectionalLight('#ffffff', keyLightIntensity);
				keyLight.position.set(2.5, 3, 4);
				scene.add(keyLight);

				// 5. 自适应响应
				const resize = () => {
					if (!hostElement || !renderer) return;
					const width = Math.max(hostElement.clientWidth, 1);
					const height = Math.max(hostElement.clientHeight, 1);
					// renderer 需要 setSize 
					renderer.setSize(width, height, false);
					// 更新透视镜的朝向
					camera.aspect = width / height;
					camera.updateProjectionMatrix();
				};
				resize();
				
				resizeObserver = new ResizeObserver(resize);
				resizeObserver.observe(hostElement);

				isReady = true;

				// 6. 渲染循环
				const renderFrame = () => {
					if (autoRotate) {
						cube.rotation.x += 0.01;
						cube.rotation.y += 0.016;
					}
					renderer?.render(scene, camera);
					animationFrame = window.requestAnimationFrame(renderFrame);
				};
				renderFrame();

			} catch (error) {
				errorMessage = error instanceof Error ? error.message : 'Failed to initialize Three.js.';
			}
		})();

		// 销毁和清理（很重要）
		return () => {
			disposed = true;
			window.cancelAnimationFrame(animationFrame);
			resizeObserver?.disconnect();

			// THREE.JS 的释放：所有通过 new 实例化的独立 WebGL 对象需要被销毁
			geometry?.dispose();
			material?.dispose();
			renderer?.dispose();

			hostElement?.replaceChildren();
		};
	});
</script>

<div class="stage-viewport">
	<!-- 这里的绝对铺满是非常必须的 -->
	<div class="stage-viewport__wrapper" bind:this={hostElement}></div>

	{#if !isReady && !errorMessage}
		<div class="stage-viewport__overlay">Booting Three.js...</div>
	{/if}

	{#if errorMessage}
		<div class="stage-viewport__overlay stage-viewport__overlay--error">{errorMessage}</div>
	{/if}
</div>

<style>
	.stage-viewport {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
	}

	.stage-viewport__wrapper {
		flex: base 100%;
		display: flex;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	.stage-viewport__overlay {
		position: absolute; inset: 0;
		display: flex; align-items: center; justify-content: center;
		background: #090d16; color: var(--color-fg-secondary);
	}
	.stage-viewport__overlay--error {
		color: var(--color-danger);
	}
</style>
```

---

## 最佳实践要点

1. **RightPanel 选择**
   Three.js 依赖全尺寸窗口以及自己的相机参数（Aspect Ratio，Frustum 控制）作渲染投影，所以**绝对不能放进 `PreviewCanvas`** 里被外层容器当作定长宽比缩放。必须使用 `<FullStage>`，让渲染器自由追踪 `hostElement` 的大小以自动重设摄像矩阵。

2. **为什么写多个 `$effect`?**
   在 Svelte 中，细粒度的状态响应最好使用多个 `$effect`，将 "修改线框属性" 和 "修改颜色属性" 等分拆开。Three.js 大多数属性（如 `material.wireframe = true`、`light.intensity = value` 或 `material.color.set(color)`）是引用修改，Svelte 组件一旦追踪到 `wireframe` 等 props 改变，直接就去打点更新了，完全不用重启渲染流。

3. **保存渲染结果：`preserveDrawingBuffer`**
   如果需要在左边加个 “导出快照” 的按钮，注意把 Three 渲染器的配置项设置为 `preserveDrawingBuffer: true`，否则你企图借由 `canvas.toDataURL()` 去获取屏幕图像时，可能会拿到一个全黑的黑块。

4. **强制规避内存泄漏**
   永远在生命周期销毁端，逐一执行 `.dispose()` 清理所引用的材质、几何体、纹理网格，不清除会造成严重的 GPU 泄露。
