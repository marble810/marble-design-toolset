# Tool Export Guide

把 tool 渲染的内容导出为 **PNG** 或 **MP4 / WebM** 是 framework 提供的开箱能力。本指南面向 tool 作者，覆盖从声明能力到注册 exporter、再到调试导出失败的完整流程。

> 阅读前提：建议先看完 [`tool-authoring-guide.md`](./tool-authoring-guide.md)，了解 tool 目录 schema、`metadata.json` 与 `index.ts` 的关系，以及 `LeftPanel` / `Section` / `PreviewCanvas` / `FullStage` 的角色分工。

## 目录

1. [设计理念](#设计理念)
2. [架构总览](#架构总览)
3. [快速上手](#快速上手三步接入)
4. [Step 1 — 声明能力](#step-1--在-metadata-中声明能力)
5. [Step 2 — 注册 exporter](#step-2--在子组件中注册-exporter)
6. [Step 3 — 验证](#step-3--运行时验证)
7. [Frame Source 详解](#frame-source-详解)
8. [Capabilities & 安全约束](#capabilities--安全约束)
9. [16-bit PNG 通路](#16-bit-png-通路)
10. [MP4 / WebM 录制](#mp4--webm-录制)
11. [完整示例](#完整示例)
12. [疑难排查](#疑难排查)
13. [API Reference](#api-reference)
14. [路线图](#路线图)

---

## 设计理念

1. **Framework 拥有 UI**：导出表单、编码、文件下载全部由 framework 完成，tool 不应实现任何与 UI / 文件 IO 相关的导出代码。
2. **声明 + 注册 双契约**：
   - `metadata.json` 中的 `export` 字段是**用户视角**的契约 —— 决定 LeftPanel 是否出现 Export Section。
   - `getCanvasExportContext().register(...)` 是**运行时**契约 —— 决定 Export 按钮是否能真正工作。
   - 两者解耦：tool 还在 lazy-load 时 LeftPanel 也能预渲染稳定结构（按钮 disabled + 提示）。
3. **容器无关**：Export context 由顶层 `ToolShell` 注入，PreviewCanvas、FullStage、自定义右侧内容内的任何子组件都可以注册 exporter。
4. **零首屏开销**：`fast-png`（16-bit 编码）通过 `await import(...)` 懒加载，仅在用户真正点击 16-bit 导出时下载。

---

## 架构总览

```
┌──────────────────────────────────────────────────────────────┐
│  ToolShell.svelte  (workspace shell, top-level)              │
│   └─ setCanvasExportContext({ exporters, register })          │
│        ▲                                                      │
│        │ getCanvasExportContext()                             │
│        │                                                      │
│   ┌────┴───────────────┐    ┌─────────────────────────────┐  │
│   │  LeftPanel         │    │  PreviewCanvas / FullStage  │  │
│   │   ├ tool sections  │    │   └ tool's preview component│  │
│   │   └ ExportSection  │    │       └ register(descriptor)│  │
│   │     (framework)    │    │                             │  │
│   └────────────────────┘    └─────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

- **唯一一个** Export Section，固定渲染在 LeftPanel 所有 tool 自定义 Section 之后。
- **不是** Dialog —— 表单与结果都嵌入在 Section 内。
- 是否渲染 Export Section 由 `ToolMetadata.export` 决定；显示哪些表单字段则由 active exporter 的 `resolved capabilities` 决定。

---

## 快速上手（三步接入）

```diff
  src/tools/my-tool/
  ├── metadata.json        // ① 声明 export 能力
  ├── index.ts
  ├── MyTool.svelte
  └── components/
      └── MyPreview.svelte // ② register exporter
```

```jsonc
// ① metadata.json
{
  "name": "My Tool",
  "desc": "...",
  "tag": ["..."],
  "version": "1.0.0",
  "enabled": true,
  "export": {
    "image": true,
    "video": true
  }
}
```

```svelte
<!-- ② components/MyPreview.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { getCanvasExportContext } from '$lib/runtime/canvas-export/context';

  let canvas: HTMLCanvasElement;
  let width = $state(512);
  let height = $state(512);

  const exportContext = getCanvasExportContext();

  onMount(() => {
    const unregister = exportContext?.register({
      kind: 'canvas',
      get contentWidth() { return width; },
      get contentHeight() { return height; },
      getCanvas: () => canvas
    });
    return () => unregister?.();
  });
</script>

<canvas bind:this={canvas} {width} {height}></canvas>
```

③ `bun run dev`，启动后在 LeftPanel 底部应该出现 **Export** Section，里面有 Image / Video 两个 tab。

---

## Step 1 — 在 metadata 中声明能力

`src/tools/<tool-id>/metadata.json` 的 `export` 字段控制 LeftPanel 行为：

```ts
interface ToolExportCapabilities {
  image?: boolean; // 默认 false
  video?: boolean; // 默认 false
}
```

| 声明 | LeftPanel 表现 |
| --- | --- |
| 字段缺省 / 两者均 false | 不渲染 Export Section |
| 仅 `image: true` | Section 仅显示 Image 表单，无 tab |
| 仅 `video: true` | Section 仅显示 Video 表单，无 tab |
| `image: true` + `video: true` | Section 顶部出现 Image / Video tab，默认 Image |

**最佳实践**：

- 若 tool 渲染的是静态图（设计 token、贴图、尺寸辅助），声明 `{ image: true }` 即可。
- 若 tool 有动画（noise scroll、shader 时间轴），声明 `{ image: true, video: true }`。
- 若 tool 是计算器 / 表单工具（如 `aspect-ratio`），不要声明 export 字段。

> 仅声明 metadata 不会自动让按钮可用。还需要在子组件中注册 exporter（Step 2），否则按钮保持 disabled 并显示提示。

---

## Step 2 — 在子组件中注册 exporter

通过 `getCanvasExportContext()` 拿到 context，再调用 `register(descriptor)` 返回**注销函数**。

### 核心 API

```ts
interface CanvasExportContextValue {
  exporters: ReadonlyArray<RegisteredExporter>;
  register: (descriptor: CanvasExporterDescriptor) => () => void;
}
```

**Descriptor 必填字段**：

```ts
interface CanvasExporterContentSize {
  readonly contentWidth: number;   // 源帧逻辑宽度（scale=1）
  readonly contentHeight: number;  // 源帧逻辑高度（scale=1）
}
```

`contentWidth` / `contentHeight` **必须由 descriptor 自报**，framework 据此驱动离屏 canvas 尺寸。可使用 `get` 访问器保持响应式。

### 选 kind

| `kind` | 适用场景 | PNG | MP4 |
| --- | --- | :-: | :-: |
| `'canvas'` | 已经有真实 `HTMLCanvasElement`（pixi、three.js、手画 2D canvas） | ✅ | ✅ |
| `'render'` | 程序化渲染（noise、shader-on-2D），可按时间/帧回放 | ✅ | ✅ |
| `'dom'` | 纯 HTML / SVG 内容，仅快照 | ✅ | ❌（强制） |

详细差异见 [Frame Source 详解](#frame-source-详解)。

### 生命周期模板

> **重要**：`getCanvasExportContext()` 内部使用 Svelte `getContext`，必须在**组件初始化期**调用 —— 即 `<script>` 顶层或 `onMount` 的**同步入口**。一旦进入 `await` 之后再调用就会抛 `lifecycle_outside_component` 错误。
>
> 推荐模式：在 `<script>` 顶层 `const exportContext = getCanvasExportContext();`，再在 `onMount` / async 闭包内复用该引用。

**Svelte 5 + onMount** 推荐写法：

```ts
import { onMount } from 'svelte';
import { getCanvasExportContext } from '$lib/runtime/canvas-export/context';

// 在组件初始化期读取 context（script 顶层）
const exportContext = getCanvasExportContext();

onMount(() => {
  const unregister = exportContext?.register({ /* ... */ });
  return () => unregister?.();
});
```

**WebGL renderer 异步初始化** 模板（注意：context 仍在 script 顶层读，async 内只用引用）：

```ts
// script 顶层 —— 必须在这里读 context
const exportContext = getCanvasExportContext();

let unregisterExporter: (() => void) | null = null;

onMount(() => {
  void (async () => {
    const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
    // ...初始化场景
    isReady = true;

    const rendererRef = renderer; // 捕获引用，便于 getter 内安全访问
    unregisterExporter = exportContext?.register({
      kind: 'canvas',
      get contentWidth() { return rendererRef.domElement.width; },
      get contentHeight() { return rendererRef.domElement.height; },
      getCanvas: () => {
        rendererRef.render(scene, camera); // 抓帧前 force render 一次
        return rendererRef.domElement;
      }
    }) ?? null;
  })();

  return () => {
    unregisterExporter?.();
    // ...销毁 renderer
  };
});
```

> **永远在组件销毁前调用注销函数**。否则旧 exporter 会留在 registry 里被 LeftPanel 取到，但其 canvas / DOM 已被释放，导出会失败或抓到旧帧。

---

## Step 3 — 运行时验证

启动 `bun run dev` 后逐项确认：

- [ ] LeftPanel 底部出现 **Export** Section（如果 metadata 声明了能力）。
- [ ] Section 内部按钮可点（如果 exporter 已注册）；否则有提示文字"This tool declared an export capability but has not registered an exporter yet."。
- [ ] 点击 Export Image：浏览器下载一个 `<tool-id>-<timestamp>.png` 文件。
- [ ] 点击 Export Video：经过 N 秒（duration）后下载 `.mp4` 或 `.webm`（视浏览器支持情况）。
- [ ] 用图片查看器打开 PNG，确认内容**非空白**。

如果 PNG 是空白：见 [疑难排查 → PNG 空白](#疑难排查)。

---

## Frame Source 详解

### Mode 1: `kind: 'canvas'` —— 直接捕获已有 HTMLCanvasElement

```ts
interface CanvasExporterCanvas extends CanvasExporterContentSize {
  kind: 'canvas';
  getCanvas: () => HTMLCanvasElement | null;
  getPixels16?: () => Pixels16Buffer | null;
  capabilities?: CapabilityFlags;
}
```

适用于：pixi、three.js、`<canvas>` + Canvas2D 主动维护的场景。

**导出行为**：

- **PNG**: framework 会调用 `getCanvas()`，把返回的 canvas 通过 `drawImage` 拷贝到 `contentWidth × contentHeight × scale` 的离屏 canvas，然后 `toBlob('image/png')`。
- **MP4**: framework 直接对返回的 canvas 调 `captureStream(fps)`，由 `MediaRecorder` 录制 `durationSeconds` 秒。
- **关键约束**：MP4 录制要求源 canvas **持续被绘制**。如果你的渲染循环只在用户交互时才推进，MP4 会得到一段静态视频。需要让 RAF 循环在录制期间持续运行。

**WebGL 必须设置 `preserveDrawingBuffer: true`**：否则浏览器可能在 composite 后清空 drawing buffer，`getCanvas()` 抓到全黑或全透明。也可在 `getCanvas` 内 force render 一次（如上模板），双重保险。

### Mode 2: `kind: 'render'` —— render-frame callback

```ts
interface CanvasExporterRender extends CanvasExporterContentSize {
  kind: 'render';
  renderFrame: (ctx: RenderFrameContext) => void | Promise<void>;
  renderFrame16?: (ctx: RenderFrame16Context) => Promise<Pixels16Buffer> | Pixels16Buffer;
  capabilities?: CapabilityFlags;
}

interface RenderFrameContext {
  canvas: HTMLCanvasElement; // framework 创建的离屏 canvas
  time: number;              // 当前帧时间（秒）
  frameIndex: number;        // 0-based 帧序号
}
```

适用于：纯函数式渲染、shader playground、procedural noise / pattern、不依赖 DOM 状态的可重放渲染。

**导出行为**：

- Framework 创建一个 `contentWidth × contentHeight × scale` 的离屏 canvas。
- **PNG**: 调用一次 `renderFrame({ canvas, time: 0, frameIndex: 0 })`，然后 `toBlob`。
- **MP4**: 使用 `captureStream(0)` + 手动 `videoTrack.requestFrame()` 驱动 —— framework 按 `1000 / fps` 节奏调用 `renderFrame`，每帧渲染完后 `requestFrame()`，确保每帧都来自 `renderFrame` 的确定输出（不会因主循环抖动丢帧）。
- 这是**最稳定**的 MP4 录制路径，强烈推荐用于程序化动画。

**注意**：不要在 `renderFrame` 内引用预览中的真实 canvas；离屏 canvas 由 framework 提供。所有渲染参数应从外层 closure 捕获 reactive state（`$state`）。

### Mode 3: `kind: 'dom'` —— DOM 静态快照（实验性）

```ts
interface CanvasExporterDom extends CanvasExporterContentSize {
  kind: 'dom';
  getElement: () => HTMLElement | null;
  capabilities?: Omit<CapabilityFlags, 'mp4' | 'pngBitDepth'>;
}
```

适用于：纯 HTML/SVG/CSS 渲染的预览，且只需要静态导出。

**导出行为**：

- Framework 把 DOM 元素序列化进 SVG `<foreignObject>`，再用 `<img>` 加载这段 SVG，最后 raster 到 canvas 完成 PNG。
- **MP4 强制不可用**（即便声明 `mp4: true` 也会被 `resolveCapabilities` 重置为 false）。
- **bit depth 强制 8**。
- 已知限制：跨域字体可能不渲染、CSS background 中的外链图片可能丢失、shadow DOM 内容不会被序列化。

如果遇到这些问题，改用 `kind: 'render'` 在 canvas 上重新绘制等效内容。

---

## Capabilities & 安全约束

```ts
interface CapabilityFlags {
  png?: boolean;          // 默认 true
  mp4?: boolean;          // 默认 true（dom 强制 false）
  pngBitDepth?: 8 | 16;   // 默认 8
}
```

`resolveCapabilities(descriptor)` 是 framework 内部纯函数，会按下面规则把声明值收敛成 `ResolvedCapabilities`：

| 输入 | 输出 |
| --- | --- |
| `kind: 'dom'` | 强制 `mp4=false`、`pngBitDepth=8` |
| `kind: 'canvas'` 声明 `pngBitDepth: 16` 但未提供 `getPixels16` | 降级为 `pngBitDepth: 8` |
| `kind: 'render'` 声明 `pngBitDepth: 16` 但未提供 `renderFrame16` | 降级为 `pngBitDepth: 8` |
| 其余 | 按声明 |

UI 副作用：

- 当 active exporter 的 `pngBitDepth === 16`，Image 表单出现 **8-bit / 16-bit** 选择器，且 16-bit 选中时 4× scale 被强制 disable（防止超出浏览器 canvas 单 buffer 上限）。
- 当 active exporter 的 `mp4 === false` 或浏览器不支持任何 `MediaRecorder` MIME，Video 表单显示 "Video recording is not available..." 提示。

---

## 16-bit PNG 通路

适用于色彩深度敏感的 tool（HDR 噪声、tone-mapped 渲染、science viz）。

**用户体验**：在 Image 表单选择 `16-bit`，framework 通过 `await import('fast-png')` 懒加载编码器（首次约 ~30KB gzipped），调用 `descriptor` 提供的 `getPixels16()` / `renderFrame16()` 拿到 `Uint16Array`，编码为 16-bit RGBA PNG 并下载。

### Canvas 模式：从 WebGL2 RGBA16F FBO `readPixels`

```ts
exportContext?.register({
  kind: 'canvas',
  get contentWidth() { return width; },
  get contentHeight() { return height; },
  getCanvas: () => sourceCanvas,
  capabilities: { pngBitDepth: 16 },
  getPixels16: () => {
    const gl = sourceCanvas.getContext('webgl2');
    if (!gl) return null;

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, hdrFbo);
    const pixels = new Uint16Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.HALF_FLOAT, pixels);

    return { data: pixels, width, height, channels: 4 };
  }
});
```

**注意**：`HALF_FLOAT` 返回的是 IEEE 754 binary16 位模式，**不是** 0..65535 的灰度值。如果你希望 PNG 通道值线性映射到原始 float 强度，需要先解码 + 归一化再写回 `Uint16Array`：

```ts
// 简化示意：把 [0..1] float 范围线性映射到 [0..65535]
const out = new Uint16Array(width * height * 4);
for (let i = 0; i < pixels.length; i++) {
  const f = halfFloatToFloat32(pixels[i]); // 自行实现或用 lib
  out[i] = Math.max(0, Math.min(65535, Math.round(f * 65535)));
}
```

### Render 模式：直接生成 16-bit buffer

```ts
exportContext?.register({
  kind: 'render',
  get contentWidth() { return width; },
  get contentHeight() { return height; },
  renderFrame: ({ canvas, time, frameIndex }) => paint8(canvas, time, frameIndex),
  capabilities: { pngBitDepth: 16 },
  renderFrame16: async ({ time, frameIndex }) => ({
    data: paint16(time, frameIndex), // Uint16Array, length = width * height * channels
    width,
    height,
    channels: 4
  })
});
```

`renderFrame16` 与 `renderFrame` 是两条独立通路：framework 为预览继续调 `renderFrame`，仅 16-bit PNG 导出时调 `renderFrame16`。两者可以共享底层算法但通常分别针对 8-bit canvas 与 16-bit buffer 优化。

### 显示提示

大多数浏览器内置图片查看器会把 16-bit PNG 降到 8-bit。Section 内联结果区会提示用户用 Photoshop / Affinity / macOS Preview 等工具查看完整深度。

---

## MP4 / WebM 录制

### 编码器选择

`pickRecorderMime()` 按以下顺序探测：

```ts
[
  'video/mp4;codecs=avc1.42E01E', // H.264 baseline
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8'
]
```

第一个 `MediaRecorder.isTypeSupported(...)` 返回 true 的就是输出格式。`Result.extension` 与 `Result.mime` 一并写回 `ExportResult`，UI 内联区域会显示实际格式。

| 浏览器 | 通常输出 |
| --- | --- |
| Safari (macOS / iOS) | MP4 (H.264) |
| Chrome (desktop) | MP4 (Chrome 110+) 或 WebM (VP9) |
| Firefox | WebM (VP9 或 VP8) |

### 参数范围

| 参数 | 取值 | 说明 |
| --- | --- | --- |
| `scale` | 1, 2, 4 | 离屏 canvas 倍数 |
| `fps` | 24, 30, 60 | 录制帧率 |
| `durationSeconds` | 1..30 | UI 强制 clamp，超出会回弹 |

> **30 秒上限**是有意为之 —— framework 不打算成为视频编辑器。需要更长时长请等待 `add-canvas-export-ffmpeg` 路线图，或在 tool 内自定义导出（脱离 framework UI）。

### 渲染模式（kind: 'render'）的稳定优势

`captureStream(0)` + 手动 `videoTrack.requestFrame()` 意味着 framework **完全控制**帧时序：

- 每帧 = 一次 `renderFrame({ time: i / fps, frameIndex: i })`
- 渲染完成后才 `requestFrame()`
- 因此不会出现"渲染慢导致 MediaRecorder 取到旧帧"或"渲染快导致丢帧"

`kind: 'canvas'` 的 MP4 录制则依赖 `captureStream(fps)` 的浏览器自动驱动，渲染稳定性由 tool 负责。

---

## 完整示例

仓库中两个生产级示例：

### Example A: Programmatic 2D — `noise-texture-creater`

文件：[`src/tools/noise-texture-creater/components/NoisePreview.svelte`](../../../src/tools/noise-texture-creater/components/NoisePreview.svelte)

要点：

- `kind: 'render'`，`renderFrame` 用 `OffscreenCanvas` + worker 生成噪声。
- `contentWidth` / `contentHeight` 用 getter 跟随用户在 LeftPanel 调整的尺寸 slider。
- 同时声明 `image: true` + `video: true` —— 实际可导出 3s × 30fps 的噪声滚动 MP4。

### Example B: WebGL — `three-cube`

文件：[`src/tools/three-cube/components/CubeViewport.svelte`](../../../src/tools/three-cube/components/CubeViewport.svelte)

要点：

- `kind: 'canvas'`，`getCanvas` 返回 `renderer.domElement`。
- WebGLRenderer 构造选项包含 `preserveDrawingBuffer: true`。
- `getCanvas` 内 `renderer.render(scene, camera)` 强制重绘一次，确保抓帧不空。
- `metadata.json` 中 `enabled: false`（因为是 starter 示例），临时改成 true 即可在 LeftPanel 看到 Export Section。

---

## 疑难排查

| 现象 | 排查 |
| --- | --- |
| **LeftPanel 没有 Export Section** | 检查 `metadata.json` 是否包含 `export.image: true` 或 `export.video: true`。两者均为 false / 缺省时不渲染。 |
| **Export Section 出现但按钮 disabled，且有提示文字** | metadata 声明了能力但 exporter 未注册。检查子组件中 `register(...)` 是否被调用、context 是否取到（`getCanvasExportContext()` 在 ToolShell 之外的子树会返回 `undefined`）。 |
| **PNG 文件是空白 / 全黑** | (a) WebGL 未启用 `preserveDrawingBuffer: true`；(b) 抓帧前未 force render；(c) `getCanvas()` 返回 null。 |
| **PNG 尺寸不对** | 检查 `contentWidth` / `contentHeight` 是否与 canvas 实际像素尺寸一致；CSS 尺寸 ≠ canvas 像素尺寸。 |
| **MP4 录制只有第一帧** | `kind: 'canvas'` 模式下源 canvas 渲染循环停止。在录制期间保持 RAF 循环运行；或改用 `kind: 'render'`。 |
| **MP4 按钮 disabled** | 浏览器不支持任何 `MediaRecorder` MIME（罕见）；或 active exporter 是 `kind: 'dom'`（强制不支持）。 |
| **16-bit 选项不出现** | 检查 `capabilities.pngBitDepth: 16` 是否声明，且对应 `getPixels16` / `renderFrame16` 是否实现。`resolveCapabilities` 会自动降级未实现的声明。 |
| **DOM 模式字体异常** | `<foreignObject>` 不会内联跨域字体。改用本地字体或 `kind: 'render'` 在 canvas 上手画文本。 |
| **重复看到旧帧** | 旧 exporter 没有注销。确认 `onMount`/`onDestroy` 中 `unregister?.()` 被调用。 |
| **`getCanvasExportContext()` 返回 undefined** | 调用点不在 `ToolShell` 子树内（例如直接从 `+page.svelte` 调）。Export context 只在 ToolShell 内部生效。 |
| **抛 `lifecycle_outside_component` 错误** | `getCanvasExportContext()` 必须在组件初始化期调用 —— `<script>` 顶层或 `onMount` 同步入口。一旦在 async 函数 `await` 之后再调用就会失败。把 `const exportContext = getCanvasExportContext();` 提到 `<script>` 顶层即可。 |

---

## API Reference

> 完整类型定义见 [`src/lib/types/canvas-export.ts`](../../../src/lib/types/canvas-export.ts)。

### Context

```ts
import {
  getCanvasExportContext,
  setCanvasExportContext
} from '$lib/runtime/canvas-export/context';

// 仅在 ToolShell.svelte 内部使用，tool 不应调用 set
type CanvasExportContextValue = {
  exporters: ReadonlyArray<RegisteredExporter>;
  register: (descriptor: CanvasExporterDescriptor) => () => void;
};
```

### Descriptor 类型

```ts
type CanvasExporterDescriptor =
  | CanvasExporterCanvas   // kind: 'canvas'
  | CanvasExporterRender   // kind: 'render'
  | CanvasExporterDom;     // kind: 'dom'

interface CanvasExporterContentSize {
  readonly contentWidth: number;
  readonly contentHeight: number;
}
```

详见上文 [Frame Source 详解](#frame-source-详解)。

### Capabilities

```ts
interface CapabilityFlags {
  png?: boolean;          // 默认 true
  mp4?: boolean;          // 默认 true，dom 强制 false
  pngBitDepth?: 8 | 16;   // 默认 8，需配套 getPixels16/renderFrame16
}

interface ResolvedCapabilities {
  png: boolean;
  mp4: boolean;
  pngBitDepth: 8 | 16;
}
```

### 工具函数（一般 tool 不需要直接用）

```ts
import {
  isMp4ExportAvailable,    // boolean，检查浏览器是否支持任何录制 MIME
  pickRecorderMime,        // 返回 { mime, extension } | null
  defaultExportFilename,   // (toolId) => '<toolId>-YYYYMMDD-HHmmss'
  triggerDownload          // (blob, filename) => void
} from '$lib/runtime/canvas-export';
```

### 元数据类型

```ts
// src/lib/types/tool.ts
interface ToolExportCapabilities {
  image?: boolean;
  video?: boolean;
}

interface ToolMetadata {
  // ...其它字段
  export?: ToolExportCapabilities;
}
```

### Export 结果

```ts
interface ExportResult {
  ok: boolean;
  filename?: string;
  mime?: string;
  extension?: string;
  bitDepth?: 8 | 16;
  error?: string;
  notice?: string;
}
```

UI 在 Section 底部内联展示成功/失败信息，tool 不需要订阅这个对象。

---

## 路线图

本次实现使用浏览器原生 `MediaRecorder`，覆盖 H.264 MP4 与 VP9/VP8 WebM。后续规划独立 OpenSpec change：

- **`add-canvas-export-ffmpeg`**：通过 `await import('@ffmpeg/ffmpeg')` 引入 ~25MB wasm core（要求 host 配置 COOP/COEP headers），覆盖：
  - 16-bit / 10-bit 视频（HEVC、VP9 high bit depth）
  - ProRes、APNG、GIF
  - 容器互转（mov/mkv/avi）
  - 任意 duration（移除 30s 上限）
- **WebGPU `rgba16float` 直采样**：当 WebGPU tool 普及后，新增 `kind: 'webgpu'` exporter 路径，绕过 `readPixels` 的格式限制。

`CapabilityFlags` 是开放对象，未来追加视频编码相关字段（如 `videoBitDepth`、`codec`）不会破坏既有 exporter。
