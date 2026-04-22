## Why

当前 tool 渲染产出的图像/动画停留在 PreviewCanvas / FullStage 内部，用户无法把成果落地为可分发的资产。Pixel design 工作流的核心交付物就是图像（PNG）与短视频（MP4），缺少统一的导出能力会迫使每个 tool 自行实现序列化、编码与下载逻辑，导致重复工作并破坏 framework 的壳层一致性。提供一个共享、framework-owned 的 Export 模块可以让所有 tool（无论使用 Canvas2D、PIXI、Three.js，还是纯 HTML/SVG；无论右侧采用 PreviewCanvas 还是 FullStage）以统一契约把渲染内容导出为 PNG 或 MP4。

## What Changes

- 新增 framework-owned 的 Export runtime（`src/lib/runtime/canvas-export/`），暴露统一的 `getCanvasExportContext().register(descriptor)` API，供 tool 在任意预览组件中声明自身的帧源（`HTMLCanvasElement`、render-frame callback，或 DOM root 快照）。
- Canvas export context 由顶层 `ToolShell` 创建并注入；tool 不再依赖 PreviewCanvas 提供 export 上下文，因此 FullStage 模式的 tool 同样可注册 exporter。
- Exporter descriptor 必须自报 `contentWidth` / `contentHeight`（可使用 getter 保持响应式），framework 以此驱动离屏 canvas 尺寸 = `contentWidth × contentHeight × scale`。
- 导出 UI 从 PreviewCanvas 工具栏下放至 LeftPanel 底部。framework 在 `LeftPanel` 中渲染一个 framework-owned 的 `Export` Section（标题固定为 "Export"），其内嵌图片 / 视频参数表单与导出按钮，**不再使用 Dialog 弹窗**。
- 每个 tool 通过 `metadata.json` 中可选的 `export: { image?: boolean, video?: boolean }` 显式声明自身导出能力。framework 按声明决定 Export Section 是否渲染、显示哪些 tab；运行时若未注册匹配 exporter，按钮保持 disabled 并给出提示。
- 提供共享 PNG 导出能力：按 active exporter 的内容尺寸 × 用户选择的 scale 渲染单帧，并触发浏览器下载。默认输出 8-bit PNG（浏览器原生 `toBlob`）。
- 新增可选的 **16-bit PNG** 输出路径：framework 通过懒加载 `fast-png` 实现 16-bit PNG 编码；exporter 通过 `capabilities.pngBitDepth: 16` 显式声明并提供 `Uint16Array` 像素源（典型来自 WebGL2 RGBA16F FBO + `readPixels`）。未声明的工具 PNG 输出默认仍为 8-bit，且不下载 16-bit 编码器。
- 提供共享 MP4 导出能力：基于 `canvas.captureStream` + `MediaRecorder` 录制指定时长 / 帧率；如目标平台不支持 H.264 则回退到 WebM 并在 UI 中明确告知。
- Export Section 暴露分辨率倍率、PNG 位深（8 / 16，按 capability 启用）、时长、帧率、文件名等通用参数；tool 可通过注册时的 `capabilities` 字段限制（例如纯静态 tool 仅暴露 PNG）。
- **路线图（不在本次范围）**：将 ffmpeg.wasm 作为独立 capability `tool-canvas-export-ffmpeg` 引入，用于支持高位深视频、ProRes、APNG/GIF、多容器互转。该路径必须独立按需加载（25MB+ wasm core）、独立 docs 页面承载、并要求宿主页面提供 COOP/COEP headers。本次提案不实现，仅在 design.md 路线图中预留接口形状。

## Capabilities

### New Capabilities
- `tool-canvas-export`: 定义 framework-owned 的画布导出契约 —— exporter 注册协议（含自报内容尺寸）、PNG/MP4 导出能力、与右侧呈现容器（PreviewCanvas / FullStage）解耦的 context 拓扑、以及 tool 与 framework 的责任边界。

### Modified Capabilities
- `tool-shell-workspace`: 在 LeftPanel 底部新增 framework-owned 的 `Export` Section（仅当 active tool 在 metadata 中声明 export 能力时出现）。同时移除原本在 PreviewCanvas 工具栏的 Export 控件 —— 导出 UI 不再属于 PreviewCanvas。

## Impact

- 代码：
  - 新增 `src/lib/runtime/canvas-export/`（exporter registry、PNG encoder wrapper、MP4 recorder wrapper、16-bit PNG encoder lazy loader、context）。
  - 新增 `src/lib/components/shell/export-section/ExportSection.svelte`（嵌入式面板）。
  - 修改 `src/lib/components/shell/tool-shell/ToolShell.svelte` 创建 registry + 注入 context。
  - 修改 `src/lib/components/shell/left-panel/LeftPanel.svelte` 在底部条件渲染 ExportSection。
  - 修改 `src/lib/components/shell/preview-canvas/PreviewCanvas.svelte` 移除所有导出相关代码与 ExportDialog。
- API：
  - `ToolShellContextValue` 之外新增独立的 `CanvasExportContextValue`；不再含 `contentWidth/contentHeight`，尺寸来自 descriptor。
  - `CanvasExporterDescriptor` 必填 `contentWidth` / `contentHeight`。
  - `ToolMetadata` 新增可选字段 `export?: { image?: boolean; video?: boolean }`。
- 依赖：MP4/WebM 编码使用浏览器原生 `MediaRecorder`，无新增运行时依赖。**新增 npm 依赖 `fast-png`**（~15KB min+gz），仅在用户触发 16-bit PNG 导出时通过动态 `import()` 加载，不进入首屏 bundle。MP4 muxing 优化（`mp4-muxer`）与 ffmpeg.wasm 路线图均不在本次提案范围。
- 文档：`docs/guides/Making Tools/` 新增 `tool-export-guide.md`，说明 metadata 声明、三种帧源模式、以及 16-bit 像素源（WebGL2 RGBA16F + `readPixels`）的对接方式。`docs/architecture/project-architecture-analysis.md` 新增 §8.7 描述 canvas-export runtime。
- 既有 tool：`hello-world`、`aspect-ratio` 不声明 export，LeftPanel 不出现 Export Section。`noise-texture-creater` 与 `three-cube` 声明 `{ image: true, video: true }` 并注册 exporter 作为参考实现。
