## Context

Marble Design Toolset 是 framework + tool 的两层架构。所有 tool 在 PreviewCanvas（或 FullStage / 自定义内容）内输出可视化结果，但 framework 目前没有定义"如何把这些结果落地为 PNG / MP4"的标准协议。
当前可观察到的相关现状：

- PreviewCanvas（[src/lib/components/shell/preview-canvas/PreviewCanvas.svelte](src/lib/components/shell/preview-canvas/PreviewCanvas.svelte)）是一个 layout 容器，内部把 tool 提供的 `children` 包在一个 `width × height` 固定的 stage 中，并应用 logical zoom / DPR 归一化。
- 工具栈差异显著：`three-cube` 使用 three.js（WebGLRenderer 提供 `domElement: HTMLCanvasElement`），`noise-texture-creater` 使用 pixi.js（`Application.canvas: HTMLCanvasElement`），未来可能有纯 Canvas2D 或 SVG/HTML 工具。
- 共享技术栈通过 [src/lib/runtime/tech-stack.ts](src/lib/runtime/tech-stack.ts) 懒加载；导出模块要遵循同一思路，避免无导出请求时把编码器 / 录制器代码塞进首屏。
- 框架硬性约束：PreviewCanvas 等布局组件由壳层拥有，tool 只能在自己面板内插入私有 UI；导出按钮必须由 framework 注入而不是由 tool 自行实现。

## Goals / Non-Goals

**Goals:**

- 提供 framework-owned 的 Export runtime + UI，使任意 tool 可以以最少的代码声明导出能力。
- Export runtime 与右侧呈现容器（PreviewCanvas / FullStage / 自定义内容）解耦：context 由顶层 `ToolShell` 创建并注入，使任何子树都能注册 exporter。
- 支持三种 frame source 模式：`canvas`（直接捕获已有的 HTMLCanvasElement）、`render`（async render-frame callback，框架在离屏 canvas 上驱动）、`dom`（DOM root 通过 `<foreignObject>` 序列化为静态 PNG，仅用于 PNG 导出）。
- Exporter descriptor 自报 `contentWidth` / `contentHeight`，框架按 scale 派生离屏 canvas 尺寸。
- PNG 导出在浏览器端单线程同步完成，输出尺寸 = `contentWidth × contentHeight × scale`（1×/2×/4×），默认 8-bit。
- 可选 **16-bit PNG** 导出：tool 在 capabilities 中声明 `pngBitDepth: 16` 并实现 `getPixels16(...) => Uint16Array | Float16Array`（典型从 WebGL2 RGBA16F FBO `readPixels` 取出）；framework 懒加载 `fast-png` 完成编码。
- MP4 导出基于 `MediaRecorder` + `canvas.captureStream` 录制；当 `MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.42E01E')` 为 true 时输出 MP4，否则降级到 WebM 并在 UI 中提示。
- 导出 UI 作为嵌入式面板挂在 LeftPanel 底部，由 framework 统一渲染；不弹出 Dialog，与 tool 自定义 Section 在同一栏目下并存。
- Tool 通过 `metadata.json` 中可选的 `export: { image?: boolean; video?: boolean }` 显式声明导出能力；未声明则 LeftPanel 不出现 Export Section。
- 当 tool 声明了能力但未注册 exporter 时，Export Section 中按钮保持 disabled 并显示提示文字。

**Non-Goals:**

- **不引入 ffmpeg.wasm**。本次保留浏览器原生 `MediaRecorder` 路径；ffmpeg.wasm 单独纳入路线图（见 Roadmap 章节），作为独立 capability 在未来提案中实现。
- 不引入 `mp4-muxer` 等额外 mux 库；浏览器原生 MP4 支持不足时降级到 WebM 即可。
- 不支持 16-bit 视频导出（MP4/WebM 编码器为 8-bit 路径）；高位深视频留给未来 ffmpeg.wasm 提案。
- 不支持服务器端渲染或离线批处理；所有导出都在用户当前浏览器会话中执行。
- 不为 PreviewCanvas 工具栏继续保留 Export 按钮 —— 导出 UI 已下放至 LeftPanel 底部，PreviewCanvas 工具栏不承载导出能力。
- 不实现进度更细粒度的 timeline scrubber / 关键帧编辑；MP4 导出仅暴露 duration + fps 两个参数。
- 不替换 LeftPanel 的 children snippet —— tool 仍可注入自定义 Section，Export Section 渲染在它们之后。

## Decisions

### Decision 1: exporter 通过 Svelte context 注册，而不是通过 ToolDefinition 静态声明

Tool 在 master 组件（或子组件）中通过 `getCanvasExportContext().register(descriptor)` 在 `$effect` 中注册 exporter，并在 cleanup 中注销。

理由：

- frame source（HTMLCanvasElement / render callback）只在 tool 运行时才存在，必须在挂载之后才能拿到引用，无法静态声明。
- 复用 PreviewCanvas 已经使用的 Svelte context 模式，与既有 `tool-shell-context.ts` 保持一致。
- 注册-注销天然与 tool tab 生命周期对齐，避免关闭 tool 后还残留 exporter。

替代方案：在 `ToolDefinition.exporters` 字段静态声明 → 否决，因为帧源是 runtime 对象，需要 effect 时序。

### Decision 2: 三种 frame source 共用同一个 `CanvasExporterDescriptor` 接口

```ts
interface CapabilityFlags {
  png?: boolean; // default true (除非 kind 不支持)
  mp4?: boolean; // default true (kind=dom 时强制 false)
  pngBitDepth?: 8 | 16; // default 8；声明 16 时必须提供 getPixels16
}

type CanvasExporterDescriptor =
  | { kind: 'canvas'; getCanvas: () => HTMLCanvasElement | null;
      getPixels16?: () => { data: Uint16Array; width: number; height: number; channels: 3 | 4 } | null;
      capabilities?: CapabilityFlags }
  | { kind: 'render'; renderFrame: (ctx: { canvas: HTMLCanvasElement; time: number; frameIndex: number }) => void | Promise<void>;
      renderFrame16?: (ctx: { time: number; frameIndex: number }) => Promise<{ data: Uint16Array; width: number; height: number; channels: 3 | 4 }>;
      capabilities?: CapabilityFlags }
  | { kind: 'dom'; getElement: () => HTMLElement | null;
      capabilities?: Omit<CapabilityFlags, 'mp4' | 'pngBitDepth'> };
```

理由：

- `kind: 'canvas'` 覆盖 pixi/three 等 WebGL 场景：tool 把 `app.canvas` / `renderer.domElement` 暴露出来即可；MP4 录制直接用同一 canvas 的 captureStream。要走 16-bit 路径时额外提供 `getPixels16`，从 RGBA16F FBO `readPixels` 取像素。
- `kind: 'render'` 覆盖 procedural / 离屏批处理（如 noise texture），框架在离屏 canvas 上按需驱动；MP4 录制时通过 `requestAnimationFrame` 调用 `renderFrame` 并把结果绘制到录制 canvas。可选 `renderFrame16` 直接返回 16-bit 像素 buffer，跳过 8-bit canvas 来回。
- `kind: 'dom'` 覆盖纯 HTML/SVG tool，使用 SVG `<foreignObject>` + `Image` 序列化为 PNG；不支持 MP4 也不支持 16-bit（`foreignObject` 路径走的是 8-bit raster）。
- `capabilities` 让 tool 显式收窄能力（例如静态 tool 关闭 MP4，或开启 16-bit PNG），UI 据此启用/禁用对应选项。

### Decision 3: 8-bit PNG / MP4 用浏览器原生 API；16-bit PNG 用懒加载 `fast-png`

**8-bit PNG**: `canvas.toBlob('image/png')`，缩放通过先把源 canvas 绘制到 `OffscreenCanvas`（或回退 `<canvas>`）的 `width × height × scale` 大小完成。无新增依赖。

**16-bit PNG**: 当用户在 dialog 中选择 16-bit 输出（仅当 exporter 声明 `pngBitDepth: 16` 时启用），framework 通过 `await import('fast-png')` 懒加载编码器，把 `Uint16Array` / `Float16Array` 像素 buffer 编码为 16-bit PNG（PNG bit depth = 16，channels 由 capability 决定，通常 RGBA8888 → 64bpp 或 RGB → 48bpp）。`fast-png` min+gz ≈ 15KB，仅在用户主动选择 16-bit 时下载。

替代方案：

- **UPNG.js**（~25KB）→ 否决，原因是 `encodeLL` 要求调用方手动处理 PNG big-endian 字节序、3 年未更新、无原生 TS 类型。
- **pngjs/browser**（~50–80KB browserify bundle，stream API）→ 否决，体积偏大且 Node 流 API 在浏览器侧使用不顺手。
- **ffmpeg.wasm**（~25MB wasm core）→ 否决，体积差三个数量级，且需要 COOP/COEP headers。仅为 16-bit PNG 引入完全失衡。

**MP4**: `canvas.captureStream(fps)` → `MediaRecorder({ mimeType })`，按优先级探测：

1. `video/mp4;codecs=avc1.42E01E`（Chrome 126+ desktop / Safari 14.1+）
2. `video/webm;codecs=vp9`
3. `video/webm;codecs=vp8`

最终 mime 决定下载文件后缀（`.mp4` / `.webm`），UI 在结果对话框中明确告知实际格式。

理由：保持基础 bundle 体积；浏览器原生 API 已能覆盖大多数导出诉求；`fast-png` 用于稀缺但高价值的 16-bit 通路；ffmpeg.wasm 留给单独的高级编码提案。

### Decision 4: Export UI 作为嵌入式面板渲染于 LeftPanel 底部

Export 控件已从 PreviewCanvas 工具栏下放至 LeftPanel 底部 —— framework 在 `LeftPanel.svelte` 中按 `metadata.export` 条件渲染一个 framework-owned 的 `Export` Section（基于现有 `Section` 容器，标题固定为 "Export"）。该 Section 内嵌：

- Image / Video tab（仅当 metadata 同时声明两者时显示 tabs；单一能力直接渲染对应表单）。
- 参数控件（scale、bit depth、fps、duration、filename）。
- Export 按钮 + 内联结果区域（成功/失败均在 Section 内部展示，**不弹 Dialog**）。

当 active exporter 列表为空时按钮 disabled 并显示提示文字，告知用户 tool 尚未注册 exporter。

理由：

- 用户视角：导出参数与 tool 的其他生成参数语义同源（都是控件式输入），统一放在 LeftPanel 比弹窗更自然。
- 架构对称：FullStage 模式的 tool（如 three-cube）也能享受 framework Export UI，无需 PreviewCanvas 作为前提。
- 符合 AGENTS.md 关于 layout shell 拥有顶层布局的硬约束 —— Export Section 由 LeftPanel 渲染、参数受 framework 约束，tool 仅注册 exporter。

### Decision 4A: Tool 通过 metadata 声明导出能力

`ToolMetadata` 新增可选字段 `export?: { image?: boolean; video?: boolean }`。框架行为：

- 两个标志均缺省/false → LeftPanel 不出现 Export Section。
- 单一为 true → Section 内只渲染对应表单，无 tab 切换。
- 两个均 true → Section 顶部出现 Image / Video tab。
- 声明了能力但运行时无 exporter → 按钮 disabled + 提示文字。

理由：metadata 是用户视角的契约（决定 UI 是否暴露能力），exporter 注册是 runtime 契约（决定 UI 是否能真正工作）。两者解耦让 framework 在 tool 还在加载/初始化时也能预渲染稳定的 LeftPanel 结构。

### Decision 5: `render` 模式下 MP4 录制使用同步驱动，避免帧丢失

录制流程：

1. 创建 `<canvas width=contentWidth*scale height=contentHeight*scale>` 作为 record canvas。
2. `const stream = recordCanvas.captureStream(0)`（手动驱动模式，0 fps）。
3. 启动 MediaRecorder。
4. 按 `1000 / fps` 间隔调用 `await renderFrame({ canvas: offscreen, time, frameIndex })`，把 offscreen 内容绘制到 record canvas，再调用 `stream.getVideoTracks()[0].requestFrame()`。
5. 达到 duration 后停止录制并下载。

理由：相比直接 `captureStream(fps)` 让浏览器自动采样，手动 `requestFrame` 能保证每一帧都来自 `renderFrame` 的确定输出，避免动画跳帧。

### Decision 6: 新增独立的 `CanvasExportContext`，由 ToolShell 顶层注入

新建 `src/lib/runtime/canvas-export/context.ts` 与现有 `tool-shell-context.ts` 平行存在；`ToolShell.svelte`（workspace shell 顶层组件）在自身 setup 中创建 `canvasExportRegistry` 并调用 `setCanvasExportContext(...)`。LeftPanel、PreviewCanvas、FullStage 与 tool 的任意子组件都可通过 `getCanvasExportContext()` 读取或调用 `register(...)`。

理由：

- 导出能力与 tool shell 的 metadata / menu actions 是两个正交的 framework concern；分离 context 便于扩展。
- 把 context 上移至 ToolShell 顶层（而非 PreviewCanvas 内部）使 export 能力与右侧呈现容器解耦 —— FullStage 模式 tool 同样能注册 exporter，且 LeftPanel 内的 ExportSection 也可读取 exporter 状态。

## Roadmap（明确不在本次范围）

以下能力作为后续独立 OpenSpec change 处理，本次仅在 runtime 中预留扩展点（capabilities 是开放对象，可在未来追加字段而不破坏现有 exporter）：

- **`add-canvas-export-ffmpeg`（候选名）**：引入 `@ffmpeg/ffmpeg` + `@ffmpeg/core`（~25MB wasm core，COOP/COEP 必需）。覆盖 16-bit / 10-bit 视频（HEVC / VP9 high bit depth）、ProRes、APNG、GIF、容器互转。该 capability 必须独立懒加载、独立 docs 页面承载，并由 docs 站点先行试点（避免污染主工作区首屏）。运行时入口建议复用现有 `loadTechStack` 模式新增 `'ffmpeg'` key。
- **WebGPU `rgba16float` 直采样**：当 WebGPU 工具普及后，新增 `kind: 'webgpu'` exporter 路径；本次不实现，但 capability 字段保持开放结构。

## Risks / Trade-offs

- **MediaRecorder 对 MP4 的支持参差** → 保留 WebM 降级路径，并在导出结果对话框中显式告知实际容器/编码格式，让用户决定是否接受。
- **16-bit PNG 在 Safari/Firefox 的可见性差** → 大多数桌面图像查看器（macOS Preview、Photoshop、Affinity）能正确读取 16-bit PNG，但浏览器内 `<img>` 渲染会被降到 8-bit。Mitigation：在导出结果对话框中告知用户该文件为 16-bit、推荐用专业工具查看。
- **`getPixels16` 性能** → WebGL `readPixels` 是同步阻塞调用；高分辨率 + 16-bit RGBA 单帧 ≈ 8MB。Mitigation：限定 16-bit 仅 PNG（不参与 MP4 录制），且 dialog 中 16-bit 时把 scale 上限降到 2×。
- **`render` 模式驱动 MP4 时的性能** → 大尺寸 + 高 fps 可能阻塞主线程。Mitigation：dialog 中限制 `scale ≤ 4`、`fps ∈ {24, 30, 60}`、`duration ≤ 30s`，并在录制期间禁用 PreviewCanvas 交互。
- **WebGL canvas 的 `preserveDrawingBuffer`** → three/pixi 默认关闭，可能导致 PNG 抓取时是空白。Mitigation：在 `kind: 'canvas'` 注册时由 tool 负责保证可读（文档要求 `preserveDrawingBuffer: true` 或在抓取前 force render）；`render` 模式由 framework 控制 offscreen canvas 不存在该问题。
- **DOM 模式的 `foreignObject` 跨域 / 字体限制** → 标记为实验性，文档中明确不支持外链字体/图片，必要时建议 tool 使用 `kind: 'render'` 替代。
- **同时存在多个 exporter** → 第一阶段限制 PreviewCanvas 内部最多注册一个 exporter；后续注册若已有，warn 并忽略，避免 UI 复杂度。

## Migration Plan

- 不需要数据迁移；新增能力对既有 tool 是 opt-in。
- 既有 `hello-world` / `aspect-ratio` 不声明 export 能力，LeftPanel 不出现 Export Section（与既有体验一致）。`noise-texture-creater` 与 `three-cube` 在本次变更中接入并作为参考实现。
- 新增的 docs 指南会引导新 tool 在 master 组件挂载时注册 exporter。

## Open Questions

- 是否需要把导出文件名暴露为 `metadata.json` 字段（例如 `exportFilenamePrefix`）？当前方案是让 Section 默认使用 `<tool-id>-<timestamp>` 并允许用户覆写，待实现阶段确认是否够用。
- 是否允许同一 tool 注册多个 exporter（例如 viewport vs 整页）？当前实现取列表第一个；未来可扩展为下拉选择。
