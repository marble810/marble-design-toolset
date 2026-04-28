# Making Tools with PixiJS

本指南带你在 **Marble Design Toolset** 里从零搭建一个基于 **PixiJS** 的 2D 纹理生成工具。读完后你能：

- 在 `LeftPanel` 中组织参数区
- 用 `PreviewCanvas` 承载固定宽高的 Pixi 画布
- 在 prop 变化时驱动 Pixi 重绘
- 通过 `loadTechStack('pixi')` 拿到框架预热好的 Pixi 实例
- 提供导出（截图为 PNG）能力

## TL;DR

1. `bun run create:tool` → 选 `preview` starter + `pixi` tech stack。
2. 在 master `.svelte` 里组合 `LeftPanel` + `<PreviewCanvas contentWidth={...} contentHeight={...}>`，把 Pixi 子组件挂在 `PreviewCanvas` 内。
3. 在 Pixi 子组件 `onMount` 中 `await loadTechStack('pixi')`，创建 `PIXI.Application` 并把 `app.canvas` 挂进 host element。
4. 用 `$effect` 监听 props，调用 renderer 的 resize / 自定义 update 函数同步参数。
5. `onMount` 返回的 cleanup 函数里 `app.destroy(true, { children: true })`。

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
- **Starter Type**: 选 `preview`（我们要用 `PreviewCanvas`）。
- **Tech Stacks**: 选 `pixi`（让框架预热共享 PixiJS 模块）。

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
import type { ToolDefinition } from '$lib/types/tool';

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
4. **生命周期**：`onMount` 内异步初始化、`onMount` 返回函数中 `destroy()`。

---

## 3. 编写主组件 (NoiseGenerator.svelte)

在根级组件中，我们组织 `LeftPanel` (参数) 和 `RightPanel` (预览)。

```svelte
<script lang="ts">
	import { LeftPanel, PreviewCanvas, RightPanel, Section } from '$lib/components/shell/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	// 引入我们将要编写的 Pixi 画布组件
	import PixiCanvas from './components/PixiCanvas.svelte';

	// ==========================================
	// 状态：工具的生成参数
	// ==========================================
	let resolution = $state(512);
	let noiseScale = $state(1.0);
	let colorA = $state('#000000');
	let colorB = $state('#ffffff');
	
	// ==========================================
	// 状态：导出与通信
	// ==========================================
	let exportRequested = $state(false);
	
	function handleExport() {
		// 切换这个标志位，触发子组件监听
		exportRequested = !exportRequested;
	}
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

	<Section title="Actions" collapsible>
		<Button variant="solid" size="md" onclick={handleExport}>Export as PNG</Button>
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
			{exportRequested}
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
- 模块类型从 `$lib/types/tech-stack` 的 `TechStackModule<'pixi'>` 派生。
- 长期存活的实例用 `import type` 从 `pixi.js` 获取类型，不要把 `Application` 或自定义控制器声明成 `any`。

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	// 从运行时获取加载器
	import { loadTechStack } from '$lib/runtime/tech-stack';
	import type { TechStackModule } from '$lib/types/tech-stack';
	import type { Application } from 'pixi.js';

	type PixiModule = TechStackModule<'pixi'>;
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
		exportRequested: boolean;
	}
	let { width, height, noiseScale, colorA, colorB, exportRequested }: Props = $props();

	// ==========================================
	// 组件及库状态
	// ==========================================
	let hostElement = $state<HTMLDivElement | null>(null);
	let isReady = $state(false);
	let errorMessage = $state('');

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

	// 监听导出请求
	$effect(() => {
		if (exportRequested && isReady && pixiApp) {
			// 由于框架保证组件会被重新执行 effect，直接执行导出逻辑
			doExport();
		}
	});

	function updatePixiRender(w: number, h: number, scale: number, ca: string, cb: string) {
		if (!pixiApp) return;
		pixiApp.renderer.resize(w, h);
		// TODO: 更新 Pixi Filter / Sprite / Graphic 参数
	}

	async function doExport() {
		if (!pixiApp) return;
		try {
			// 依赖 PIXI 机制获取 Canvas 的 Blob 或 dataURL
			const base64 = await pixiApp.renderer.extract.base64(pixiApp.stage);
			// 执行下载
			const a = document.createElement('a');
			a.download = 'noise.png';
			a.href = base64;
			a.click();
		} catch (err) {
			console.error('Export failed:', err);
		}
	}

	// ==========================================
	// 初始化生命周期
	// ==========================================
	onMount(() => {
		let disposed = false;

		void (async () => {
			try {
				// 获取预加载好的 PIXI，因为 index.ts 中声明了，此时应该瞬间返回
				const PIXI: PixiModule = await loadTechStack('pixi');

				if (disposed || !hostElement) return;

				// 创建 Pixi 应用，背景通常设置为透明，因为 PreviewCanvas 有棋盘格
				pixiApp = new PIXI.Application();
				await pixiApp.init({
					width,
					height,
					backgroundAlpha: 0, 
					resolution: window.devicePixelRatio || 1,
					autoDensity: true // 处理高分屏表现
				});
				
				// 将 Canvas 丢进 DOM
				hostElement.replaceChildren(pixiApp.canvas);

				// TODO: 在这里添加最初的 Sprite、滤镜或 Mesh 逻辑
				// const sprite = new PIXI.Sprite(...)
				// pixiApp.stage.addChild(sprite)

				isReady = true;

				// 主动调一次渲染刷新以应用初始参数
				updatePixiRender(width, height, noiseScale, colorA, colorB);

			} catch (error) {
				errorMessage = error instanceof Error ? error.message : 'Failed to initialize Pixi.js.';
			}
		})();

		return () => {
			disposed = true;
			if (pixiApp) {
				pixiApp.destroy(true, { children: true, texture: true, baseTexture: true });
			}
			hostElement?.replaceChildren();
		};
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

	如果你的 Pixi tool 在隐藏标签中需要暂停 ticker、render loop 或高频重算，请读取 `getToolSessionContext()` 暴露的 `isActive()`，在非活动态跳过刷新，在重新激活时恢复，而不是依赖切 tab 自动 destroy。

4. **释放资源**
	在 `onMount` 返还的清空函数中，必须调用 `pixiApp.destroy(true)` 以回收 WebGL Context 并清理节点，否则真正关闭 tab、组件重建或异常重挂载后会导致内存泄漏。

5. **处理导出操作的通信**
   为了导出生成结果，你可以传入一个 `onExport` 函数回调，或者像本例一样传递一个 `$state` 开关变量，通过 `$effect` 捕捉开关的变化，从而在挂载有 PIXI 实例的组件里去提取 `.base64()` 数据。