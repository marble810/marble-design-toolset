## 1. Runtime 基础

- [x] 1.1 创建 `src/lib/runtime/canvas-export/` 目录与 `index.ts` 桶导出
- [x] 1.2 在 `src/lib/types/canvas-export.ts` 定义 `CanvasExporterDescriptor`（含必填 `contentWidth` / `contentHeight` + 可选 `getPixels16` / `renderFrame16`）、`CapabilityFlags`、`CanvasExportContextValue`（不再含 contentWidth/Height，仅 `exporters` + `register`）、`PngExportOptions`、`Mp4ExportOptions`、`ExportResult`
- [x] 1.3 在 `canvas-export/context.ts` 实现 `setCanvasExportContext` / `getCanvasExportContext`
- [x] 1.4 在 `canvas-export/registry.svelte.ts` 实现基于 `$state` 的 exporter 注册表，提供 `register(descriptor) => unregister` 与响应式 `exporters` 快照；`resolveCapabilities(descriptor)` 强制 dom 模式 mp4=false / pngBitDepth=8，并按 16-bit 源能力降级
- [x] 1.5 在 `src/lib/types/tool.ts` 中给 `ToolMetadata` 增加可选 `export: { image?: boolean; video?: boolean }` 字段

## 2. PNG 导出实现（8-bit）

- [x] 2.1 实现 `canvas-export/png.ts`：根据 exporter `kind` + 描述符自报的 `contentWidth/contentHeight` 与 scale 在离屏 canvas 上生成像素尺寸 = `contentSize × scale` 的 PNG Blob
- [x] 2.2 为 `kind: 'canvas'` 实现源 canvas → 缩放 canvas 的 drawImage 路径
- [x] 2.3 为 `kind: 'render'` 实现 `await renderFrame({ canvas, time: 0, frameIndex: 0 })` 后 `toBlob('image/png')`
- [x] 2.4 为 `kind: 'dom'` 实现基于 SVG `<foreignObject>` + `<img>` 的 DOM → PNG 序列化路径
- [x] 2.5 实现 `triggerDownload(blob, filename)` 工具函数（共享给 PNG 与 MP4）
- [x] 2.6 在 `canvas-export.test.ts` 中覆盖 `resolveCapabilities` / `extensionFor` / `pickRecorderMime` / `defaultExportFilename` 的纯函数行为

## 2A. 16-bit PNG 导出实现（lazy `fast-png`）

- [x] 2A.1 在 `package.json` 中新增 `fast-png` 依赖（不要静态 import，只在 png16.ts 中 `await import('fast-png')`）
- [x] 2A.2 实现 `canvas-export/png16.ts`：动态加载 `fast-png`，提供 `encodePng16({ data, width, height, channels })` 返回 Blob
- [x] 2A.3 为 `kind: 'canvas'` 实现 16-bit 路径：调用 exporter `getPixels16()`，调用 png16 编码，触发下载
- [x] 2A.4 为 `kind: 'render'` 实现 16-bit 路径：调用 exporter `renderFrame16({ time: 0, frameIndex: 0 })`，调用 png16 编码，触发下载
- [x] 2A.5 在 `resolveCapabilities` 中强制过滤：`kind: 'dom'` 与未提供 `getPixels16` / `renderFrame16` 的 exporter 不能启用 `pngBitDepth: 16`
- [x] 2A.6 测试：mock fast-png 动态导入，断言按 capability 启用的调用路径与不启用时不加载的行为

## 3. MP4 / WebM 录制实现

- [x] 3.1 实现 `canvas-export/mime.ts`：按优先级探测 `video/mp4;codecs=avc1.42E01E` → `video/webm;codecs=vp9` → `video/webm;codecs=vp8`
- [x] 3.2 实现 `canvas-export/mp4.ts`：通用录制循环 + `MediaRecorder` 封装
- [x] 3.3 为 `kind: 'canvas'` 实现 `sourceCanvas.captureStream(fps)` 的连续录制路径
- [x] 3.4 为 `kind: 'render'` 实现 `recordCanvas.captureStream(0)` + 手动 `requestFrame()` 的逐帧驱动路径
- [x] 3.5 实现录制中断逻辑：renderFrame 抛错时停止 recorder、丢弃 blob、传播错误到 UI 层
- [x] 3.6 测试：`pickRecorderMime` 通过 mock `globalThis.MediaRecorder.isTypeSupported` 覆盖三档 mime 的优先级与降级

## 4. ToolShell + Context 注入（context 上移，与右侧容器解耦）

- [x] 4.1 在 `ToolShell.svelte` 中创建 `canvasExportRegistry` 并调用 `setCanvasExportContext(...)`，使 LeftPanel / PreviewCanvas / FullStage 全部子树都能 `getCanvasExportContext()`
- [x] 4.2 从 `PreviewCanvas.svelte` 中移除 export 按钮、ExportDialog 挂载、`createCanvasExportRegistry` 调用与所有 export 相关 state；保留 Fit / 1:1 / 缩放 / actions snippet
- [x] 4.3 删除 `src/lib/components/shell/preview-canvas/ExportDialog.svelte`

## 5. LeftPanel Export Section（嵌入式面板）

- [x] 5.1 新增 `src/lib/components/shell/export-section/ExportSection.svelte`（基于现有 `Section` 容器，非 Dialog）
- [x] 5.2 实现 Image / Video tab 切换（仅当 metadata 同时声明两者时显示 tabs；单一能力时直接渲染对应表单）
- [x] 5.3 实现 Image 表单：scale ∈ {1, 2, 4}、bit depth 8/16（仅 active exporter 声明 16 时显示）、文件名输入（不含扩展名）；选择 16-bit 时 scale 上限 2
- [x] 5.4 实现 Video 表单：scale ∈ {1, 2, 4}、fps ∈ {24, 30, 60}、duration ∈ [1, 30] 秒、文件名输入；blur 时钳制
- [x] 5.5 实现默认文件名生成 `<tool-id>-<yyyymmdd-hhmmss>`，由 `ToolMetadata.name` slug 推导
- [x] 5.6 实现内联结果区域：成功提示文件名 / 16-bit notice，失败展示错误；不弹 Dialog
- [x] 5.7 在 `LeftPanel.svelte` 末尾按 `metadata.export` 条件渲染 `<ExportSection />`；新增 `src/lib/components/shell/export-section/index.ts` 桶导出
- [x] 5.8 当 active exporter 为空时，Export Section 显示提示文字并把所有按钮 disabled

## 6. Tool 端 metadata + 范例

- [x] 6.1 `noise-texture-creater/metadata.json` 添加 `"export": { "image": true, "video": true }`；`NoisePreview.svelte` 在 register descriptor 中以响应式 getter 提供 `contentWidth` / `contentHeight`
- [x] 6.2 `three-cube/metadata.json` 添加 `"export": { "image": true, "video": true }`；`CubeViewport.svelte` 启用 `preserveDrawingBuffer: true`，注册 `kind:'canvas'` exporter，在 `getCanvas` 内 force render 后返回 canvas，并以 getter 暴露当前 canvas 像素尺寸；销毁时 unregister
- [x] 6.3 在 `docs/guides/Making Tools/tool-export-guide.md` 中描述：metadata.export 声明、三种 frame source 模式、capabilities 字段、16-bit PNG 对接（WebGL2 RGBA16F FBO + readPixels(HALF_FLOAT) + fast-png 懒加载）、常见陷阱（preserveDrawingBuffer、字体/跨域）、ffmpeg 路线图
- [x] 6.4 更新 `docs/architecture/project-architecture-analysis.md` 中 framework runtime 章节（§8.7 Canvas Export Runtime），描述 ToolShell 顶层 context、LeftPanel ExportSection、ffmpeg 预留

## 7. 验证

- [x] 7.1 `npm run build` 通过
- [x] 7.2 `npm test` 全绿（34/34）
- [x] 7.3 dev server 手动验证（用户已在浏览器中确认）：
  - [x] 7.3.1 noise-texture-creater LeftPanel 底部出现 Export Section，可导出 1×/2×/4× PNG
  - [x] 7.3.2 同一 tool 可导出 3s × 30fps MP4 / WebM 并能正常播放
  - [x] 7.3.3 hello-world / aspect-ratio LeftPanel 不出现 Export Section
  - [x] 7.3.4 启用 three-cube（临时把 metadata `enabled` 改为 true）后 Export Section 出现且 PNG 不为空白
- [x] 7.4 `bunx openspec validate add-tool-canvas-export --strict` 通过（最终验证）
