# 使用 PixiJS 编写 Tool

本指南带你在 **Marble Design Toolset** 里从零搭建一个基于 **PixiJS** 的 2D 纹理生成工具。读完后你能：

- 在 `LeftPanel` 中组织参数区
- 用 `PreviewCanvas` 承载固定宽高的 Pixi 画布
- 在 prop 变化时驱动 Pixi 重绘
- 通过公共 SDK 中的 render host helper 拿到框架预热好的 Pixi 实例
- 提供导出（截图为 PNG）能力

## TL;DR

1. `bun run create:tool` → 优先选 `pixi-preview` recipe。
2. 脚手架会声明 `techStack: ['pixi']`，并生成 `PreviewCanvas` + Pixi 子组件的最小 wiring。
3. 在 Pixi 子组件里继续使用公共 SDK 的 `createRenderHostLifecycle()` 与 `createPixiApplicationHost()`。
4. 用 `$effect` 监听 props，调用 renderer 的 resize / 自定义 update 函数同步参数。
5. cleanup、session active 与 exporter 注销优先挂到 render host lifecycle，不要手写第二套宿主生命周期。

## 适用场景

PixiJS 适合高性能 2D 渲染、过程纹理生成、粒子效果或复杂 2D 滤镜组合。在 Marble Design Toolset 中，这类工具通常用 `PreviewCanvas` 作为展示舞台：它把画布居中、Fit/1:1 缩放、拖拽平移和棋盘格背景全部包了，工具本身只需要专注 Pixi 渲染逻辑。

---

## 1. 使用脚手架初始化目录

强烈推荐使用项目提供的命令行脚手架来创建基础骨架。

```bash
bun run create:tool
```

交互提示时：

- **Tool Name**: 输入工具名，例如 `Noise Generator`（自动转成 id `noise-generator`）。
- **Capability Recipe**: 优先选 `pixi-preview`。如果你选择 `custom`，再手动选 `preview` starter 和 `pixi` tech stack。

脚手架会在 `src/tools/noise-generator/` 下创建符合 schema 的 `metadata.json`、`index.ts`、唯一的 root-level master `.svelte`，以及 `components/` 私有目录。

### 如果你手工创建

准备以下文件结构（root-level 只能有一个 `.svelte`，其余子组件都放进 `components/`）：
```text
src/tools/noise-generator/
├── metadata.json
├── index.ts
├── NoiseGenerator.svelte
└── components/
    └── PixiCanvas.svelte
```

`index.ts` 必须显式声明所需的计算栈：
```typescript
import metadata from './metadata.json';
import type { ToolDefinition } from '$lib/tool-sdk/index.js';

const definition = {
	metadata,
	techStack: ['pixi'],
	loadComponent: () => import('./NoiseGenerator.svelte')
} satisfies ToolDefinition;

export default definition;
```

---

## 2. 设计交互与数据流

标准 Pixi 工具的职责拆分：

1. **主组件**：维护参数 `$state`，组合 `LeftPanel` 与 `RightPanel`，把参数以 props 推到 Pixi 子组件。
2. **右侧舞台**：用 `PreviewCanvas` 提供固定宽高的画布区域；Pixi 子组件作为 PreviewCanvas 的 children。
3. **参数同步**：在 Pixi 子组件用 `$effect` 监听 props 变化并调用 Pixi 实例方法。
4. **生命周期**：使用 `createRenderHostLifecycle` 与 `createPixiApplicationHost` 管理初始化、session active、导出注册和销毁。

---

### 统一 Host Lifecycle

Pixi 工具推荐从公共 SDK 引入 `createRenderHostLifecycle()`。它是 render-host 版的统一 host lifecycle helper，会把以下宿主阶段串在一起：

- `runInit(...)`：初始化 Pixi 应用、scene、纹理等宿主资源；成功后进入 ready，异常时写入 error。
- `isSessionActive` / `onActiveChange(...)`：跟随 workspace tab 的 active / inactive 状态；切换标签不会重建会话。
- `addCleanup(...)`：把 WebGL、Ticker、ResizeObserver、纹理等释放动作挂到同一条 cleanup 链。
- `registerCanvasExporter(...)` / `registerRenderExporter(...)`：注册 exporter，并在 lifecycle cleanup 时自动注销，避免 Export UI 持有失效 canvas。

helper 只编排宿主状态，不接管你的 Pixi scene、shader、filter、simulation 或绘制函数。非 Pixi / 非 render-host 场景若只需要同样的 init、active、cleanup 和 exporter 语义，可以直接使用 SDK 中的 `createToolHostLifecycle()`。

## 3. 编写主组件 (NoiseGenerator.svelte)

在根级组件中，我们组织 `LeftPanel` (参数) 和 `RightPanel` (预览)。

```svelte
<script lang="ts">
	import { LeftPanel, PreviewCanvas, RightPanel, Section } from '$lib/components/shell/index.js';
	// 引入我们将要编写的 Pixi 画布组件
	import PixiCanvas from './components/PixiCanvas.svelte';

	// ==========================================
	// 状态：工具的生成参数
	// ==========================================
	let resolution = $state(512);
	let noiseScale = $state(1.0);
	let colorA = $state('#000000');
	let colorB = $state('#ffffff');
</script>

<LeftPanel>
	<Section title="Resolution">
		<label class="noise-generator__field">
			<span class="noise-generator__caption">Size (px)</span>
			<!-- 我们要求全部使用 class="pixel-input" 以及原生的绑定 -->
			<input class="pixel-input" type="number" bind:value={resolution} step="64" min="64" max="2048" />
		</label>
	</Section>

	<Section title="Noise Settings">
		<label class="noise-generator__field">
			<span class="noise-generator__caption">Scale</span>
			<input class="pixel-input" type="number" bind:value={noiseScale} step="0.1" min="0.1" />
		</label>
	</Section>

	<Section title="Colors">
		<div class="noise-generator__flex-row">
			<label class="noise-generator__field">
				<span class="noise-generator__caption">Color A</span>
				<input class="pixel-input" type="text" bind:value={colorA} />
			</label>
			<label class="noise-generator__field">
				<span class="noise-generator__caption">Color B</span>
				<input class="pixel-input" type="text" bind:value={colorB} />
			</label>
		</div>
	</Section>

</LeftPanel>

<RightPanel>
	<!-- 使用 PreviewCanvas，它会自动提供背景棋盘格、缩放控制和外层限定区 -->
	<!-- 我们把当前的逻辑尺寸传给它 -->
	<PreviewCanvas contentWidth={resolution} contentHeight={resolution} label="Noise Preview">
		<!-- 将参数属性往下传给封装了 Pixi.js 的私有组件 -->
		<PixiCanvas 
			width={resolution} 
			height={resolution} 
			{noiseScale}
			{colorA}
			{colorB}
		/>
	</PreviewCanvas>
</RightPanel>

<style>
	/* ...这里使用标准的 CSS 和 CSS 变量... */
	.noise-generator__field { display: flex; flex-direction: column; gap: var(--space-2); margin-bottom: var(--space-4); }
	.noise-generator__caption { color: var(--color-fg-secondary); font-size: var(--font-size-1); letter-spacing: 0.08em; text-transform: uppercase; }
	.noise-generator__flex-row { display: flex; gap: var(--space-3); }
</style>
```

---

## 4. 接入 PixiJS (PixiCanvas.svelte)

在子组件中，利用 `loadTechStack` 获取 PixiJS。这样框架会在外层保证库被加载并缓存，内部直接拿来用即可。我们需要处理：创建应用、挂载节点、响应参数变化、销毁。

推荐把类型写法固定成两层：
- 模块类型从 `$lib/tool-sdk/index.js` 的 `TechStackModule<'pixi'>` 派生。
- 长期存活的实例用 `import type` 从 `pixi.js` 获取类型，不要把 `Application` 或自定义控制器声明成 `any`。

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import {
		createPixiApplicationHost,
		createRenderHostLifecycle
	} from '$lib/tool-sdk/index.js';
	import type { Application } from 'pixi.js';

	type PixiApp = Application;

	// ==========================================
	// Props 接收
	// ==========================================
	interface Props {
		width: number;
		height: number;
		noiseScale: number;
		colorA: string;
		colorB: string;
	}
	let { width, height, noiseScale, colorA, colorB }: Props = $props();

	// ==========================================
	// 组件及库状态
	// ==========================================
	const renderHost = createRenderHostLifecycle();
	let hostElement = $state<HTMLDivElement | null>(null);
	const isReady = $derived(renderHost.isReady);
	const errorMessage = $derived(renderHost.errorMessage);

	// 保存 Pixi 应用实例以便能在 prop 变化时调用
	let pixiApp: PixiApp | null = null;

	// 我们用一个 effect 来监听参数变化并要求 Pixi 重绘
	// （这里演示为重新渲染，具体依赖滤镜、着色器或材质的写法）
	$effect(() => {
		if (isReady && pixiApp) {
			// 在这里使用 width, height, noiseScale, colorA, colorB 去更新着色器 uniform 
			// 并触发重绘
			updatePixiRender(width, height, noiseScale, colorA, colorB);
		}
	});

	function updatePixiRender(w: number, h: number, scale: number, ca: string, cb: string) {
		if (!pixiApp) return;
		pixiApp.renderer.resize(w, h);
		// TODO: 更新 Pixi Filter / Sprite / Graphic 参数
	}

	// ==========================================
	// 初始化生命周期
	// ==========================================
	onMount(() => {
		void renderHost.runInit(async () => {
			if (!hostElement) {
				throw new Error('Pixi host is unavailable.');
			}

			const pixiHost = await createPixiApplicationHost(renderHost, {
				hostElement,
				init: {
					width,
					height,
					backgroundAlpha: 0, 
					resolution: window.devicePixelRatio || 1,
					autoDensity: true // 处理高分屏表现
				}
			});
			pixiApp = pixiHost.app;

			// TODO: 在这里添加最初的 Sprite、滤镜或 Mesh 逻辑
			// const sprite = new PIXI.Sprite(...)
			// pixiApp.stage.addChild(sprite)

			renderHost.registerCanvasExporter(
				{
					kind: 'canvas',
					get contentWidth() { return width; },
					get contentHeight() { return height; },
					getCanvas: () => pixiApp?.canvas ?? null
				},
				{ id: 'pixi-canvas', label: 'Pixi Canvas' }
			);

			// 主动调一次渲染刷新以应用初始参数
			updatePixiRender(width, height, noiseScale, colorA, colorB);
		}, 'Failed to initialize Pixi.js.');
	});
</script>

<div class="pixi-canvas-host">
	<!-- Canvas 将被挂载到这里 -->
	<div 
		class="pixi-canvas-host__container" 
		bind:this={hostElement}
		style="width: 100%; height: 100%;" 
	></div>

	{#if !isReady && !errorMessage}
		<div class="pixi-canvas-host__overlay">Booting Pixi.js...</div>
	{/if}

	{#if errorMessage}
		<div class="pixi-canvas-host__overlay pixi-canvas-host__overlay--error">{errorMessage}</div>
	{/if}
</div>

<style>
	.pixi-canvas-host {
		position: relative;
		width: 100%;
		height: 100%;
	}
	
	.pixi-canvas-host__container {
		display: flex;
		/* 保证它铺满由 PreviewCanvas 的子插槽限定的宽高 */
	}

	.pixi-canvas-host__overlay {
		position: absolute;
		top: 0; left: 0; right: 0; bottom: 0;
		display: flex; align-items: center; justify-content: center;
		background: rgba(0, 0, 0, 0.5);
		color: var(--color-fg-secondary);
	}
	.pixi-canvas-host__overlay--error {
		color: var(--color-danger);
	}
</style>
```

---

## 最佳实践要点

1. **谁来计算宽高和拉伸？**
   在 `Pixi` 环境下，对于标准图像处理，**不要去计算屏幕剩余的响应式区域**。你应该用类似 `512x512` 这样的逻辑尺寸去给 `PreviewCanvas` 传参：`<PreviewCanvas contentWidth={512} contentHeight={512}>`。PreviewCanvas 会处理外层平移、放大、缩小与滚动。对 Pixi 组件内部而言，它认为自己渲染的始终是一块 `512x512` 的死区（只受 devicePixelRatio 的高分屏加成）。
   
2. **状态驱动渲染**
   使用 Svelte 5 的 `$effect`。你从父组件传递 `noiseScale` 等 prop；子组件只管监听 prop。只要 prop 变化了，立刻触发 `pixiApp.renderer.render(pixiApp.stage)` 或者是更新着色器的 uniform。

3. **区分“隐藏”与“销毁”**
	当前 workspace 采用 keep-alive tab session。切换到别的 tab 时，Pixi 组件通常只是进入隐藏态，并不会立刻卸载；真正卸载发生在用户关闭该 tab 时。所以 `onMount` 返还的清理函数依然必须调用 `pixiApp.destroy(true)`，但它对应的是“会话销毁”，不是普通 tab 切换。

	如果你的 Pixi tool 在隐藏标签中需要暂停 ticker、render loop 或高频重算，请使用 `createRenderHostLifecycle()` 的 `startAnimationLoop(...)`，它会在非活动态暂停回调，在重新激活时恢复。

4. **释放资源**
	使用 `createPixiApplicationHost(renderHost, ...)` 时，framework helper 会在 lifecycle dispose 时调用 `app.destroy(...)` 并清理宿主节点。如果你仍然手写 Pixi 初始化，必须在清理函数中调用 `pixiApp.destroy(...)` 以回收 WebGL Context。

5. **处理导出**
   不要在 Pixi tool 内手写 `base64`、Blob 下载或隐藏 `<a>` 标签。需要导出时，在 `metadata.json` 声明 `export` 能力，并使用 `renderHost.registerCanvasExporter(...)` 注册 Pixi canvas；Export Section、编码、文件名和下载都由 framework 负责。