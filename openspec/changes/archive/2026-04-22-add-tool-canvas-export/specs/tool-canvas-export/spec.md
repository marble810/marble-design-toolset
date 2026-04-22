## ADDED Requirements

### Requirement: Framework 提供共享的画布导出 runtime
工作区 SHALL 在 framework 层提供一个共享的 canvas export runtime，并通过独立的 Svelte context 暴露给 tool。该 context MUST 与 `ToolShellContextValue` 解耦，且 MUST 至少提供 `register(descriptor)`（注册一个 exporter，返回注销函数）与 `exporters`（当前已注册的 exporter 快照）两个能力。该 context MUST 在 `ToolShell` 顶层创建，使任意子树（LeftPanel、PreviewCanvas、FullStage、tool 自定义子组件）都能调用 `getCanvasExportContext()` 完成注册。Tool MUST NOT 自行实现 PNG / MP4 编码或下载逻辑。

#### Scenario: Tool 在挂载时注册 exporter
- **WHEN** 某个 tool 在其预览组件中通过 `getCanvasExportContext().register(descriptor)` 注册 exporter
- **THEN** framework 把该 exporter 加入当前工作区的 exporter 列表，并返回一个可在组件销毁时调用的注销函数

#### Scenario: Tool 卸载或被关闭
- **WHEN** 注册了 exporter 的 tool 标签页被关闭或对应组件被销毁
- **THEN** framework 自动移除该 exporter，确保不再被 Export UI 调用

#### Scenario: 同一 tool 同时使用 PreviewCanvas 与 FullStage 之外的呈现方式
- **WHEN** tool 在任何子组件（无论位于 PreviewCanvas 内、FullStage 内还是其他容器内）中调用注册
- **THEN** 注册成功，因为 export context 由顶层 `ToolShell` 提供，不依赖任何具体右侧容器

### Requirement: Exporter descriptor 自报内容尺寸并支持三种 frame source 模式
Canvas export runtime SHALL 接受三种类型的 `CanvasExporterDescriptor`：`canvas`（直接捕获已有的 `HTMLCanvasElement`）、`render`（async render-frame callback，由 framework 在 framework 拥有的 canvas 上驱动）、`dom`（DOM root 的静态快照，仅用于 PNG）。每个 descriptor MUST 提供 `contentWidth` 与 `contentHeight`（可使用 getter 以保持响应式），表示导出帧在 scale=1 下的逻辑像素尺寸；framework MUST NOT 依赖任何特定预览容器（如 PreviewCanvas）来推断尺寸。每个 descriptor MUST 允许通过 `capabilities` 字段显式声明它支持 `png` 与 / 或 `mp4`。

#### Scenario: WebGL tool 注册 canvas 模式 exporter
- **WHEN** 一个使用 pixi 或 three 的 tool 注册 `{ kind: 'canvas', contentWidth, contentHeight, getCanvas: () => app.canvas }`
- **THEN** framework 在 PNG 导出时以 `contentWidth × contentHeight × scale` 在离屏 canvas 上 drawImage 该源 canvas，在 MP4 导出时以同一源 canvas 作为 captureStream 源

#### Scenario: 程序化 tool 注册 render 模式 exporter
- **WHEN** 一个 tool 注册 `{ kind: 'render', contentWidth, contentHeight, renderFrame: async ({ canvas, time, frameIndex }) => ... }`
- **THEN** framework 按 `contentWidth × contentHeight × scale` 创建离屏 canvas 并调用 `renderFrame`，使用其输出生成 PNG 或 MP4 帧

#### Scenario: DOM tool 注册 dom 模式 exporter 但请求 MP4
- **WHEN** 一个 `kind: 'dom'` 的 exporter 在 capabilities 中只声明了 `png`，UI 中 MP4 选项被请求
- **THEN** framework 拒绝该请求并保持 MP4 选项处于 disabled 状态

### Requirement: PNG 导出按 descriptor 内容尺寸与可选倍率输出
Framework SHALL 提供 PNG 导出能力，输出图像的像素尺寸 MUST 等于 active exporter `contentWidth × contentHeight × scale`，其中 `scale` 由用户在 Export panel 中选择，至少包含 1×、2×、4× 三档。导出 MUST 以 PNG 容器输出，且 MUST 通过浏览器下载交付给用户。默认输出位深为 8-bit。

#### Scenario: 用户以 2× 倍率导出 PNG
- **WHEN** 用户在 Export panel 中选择 PNG、scale = 2× 并确认
- **THEN** 浏览器下载一个像素尺寸为 `contentWidth*2 × contentHeight*2` 的 PNG 文件

#### Scenario: render 模式 exporter 的 PNG 导出
- **WHEN** 当前 exporter 是 `kind: 'render'` 且用户触发 PNG 导出
- **THEN** framework 在尺寸符合所选 scale 的 framework 拥有 canvas 上调用一次 `renderFrame({ time: 0, frameIndex: 0 })`，并把结果编码为 PNG

#### Scenario: PNG 抓取时 WebGL canvas 内容为空
- **WHEN** `kind: 'canvas'` exporter 指向的 canvas 由于未启用 `preserveDrawingBuffer` 等原因被读出空白
- **THEN** framework 不会因此崩溃，并 SHALL 在 Export panel 的结果区域中提示用户检查 tool 的 canvas 配置

### Requirement: 16-bit PNG 导出按 exporter capability 启用并通过懒加载编码器实现
Framework SHALL 支持可选的 16-bit PNG 输出路径，并 MUST 仅在 exporter 显式声明 `capabilities.pngBitDepth === 16` 时启用。当启用时，exporter MUST 提供 16-bit 像素源（`kind: 'canvas'` 时通过 `getPixels16()` 返回 `Uint16Array`，`kind: 'render'` 时通过 `renderFrame16()` 返回 `Uint16Array`）。Framework MUST 通过动态 `import()` 在用户首次触发 16-bit 导出时才加载 PNG 16-bit 编码器（`fast-png`），且 MUST NOT 把该编码器打入首屏 bundle。`kind: 'dom'` exporter MUST NOT 支持 16-bit PNG。

#### Scenario: WebGL2 tool 注册 16-bit canvas exporter
- **WHEN** 一个 tool 使用 WebGL2 RGBA16F FBO 渲染并注册 `{ kind: 'canvas', getCanvas, getPixels16, capabilities: { pngBitDepth: 16 } }`
- **THEN** Export panel 中显示 "8-bit" 与 "16-bit" 两个 PNG 位深选项

#### Scenario: 普通 8-bit exporter 不暴露 16-bit 选项
- **WHEN** 一个 exporter 未声明 `pngBitDepth: 16`（或显式声明为 8）
- **THEN** Export panel 中只显示 8-bit PNG 选项，且 framework MUST NOT 加载 16-bit PNG 编码器

#### Scenario: 用户首次触发 16-bit PNG 导出
- **WHEN** 用户在 Export panel 中选择 16-bit PNG 并确认
- **THEN** framework 通过动态 `import()` 加载 `fast-png`，调用 `getPixels16()` / `renderFrame16()` 获取像素 buffer，编码出 PNG bit depth = 16 的文件并触发下载

#### Scenario: dom exporter 请求 16-bit
- **WHEN** 一个 `kind: 'dom'` exporter 在 capabilities 中尝试声明 `pngBitDepth: 16`
- **THEN** framework 忽略该声明并继续按 8-bit PNG 处理（且 panel 中不出现 16-bit 选项）

### Requirement: MP4 导出基于 MediaRecorder 并在不可用时降级到 WebM
Framework SHALL 提供 MP4 导出能力，使用 `canvas.captureStream` + `MediaRecorder` 录制。framework MUST 按以下优先级探测可用容器/编码：`video/mp4;codecs=avc1.42E01E` → `video/webm;codecs=vp9` → `video/webm;codecs=vp8`。若最终容器不是 MP4，framework MUST 在 Export panel 的结果区域中明确告知实际格式与文件后缀。

#### Scenario: 浏览器原生支持 MP4
- **WHEN** `MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.42E01E')` 返回 true
- **THEN** framework 输出 `.mp4` 文件

#### Scenario: 浏览器仅支持 WebM
- **WHEN** MP4 mime 不被支持但 WebM mime 被支持
- **THEN** framework 输出 `.webm` 文件，并在结果区域中告知用户实际格式

#### Scenario: 所有候选 mime 均不被支持
- **WHEN** 三个候选 mime 都返回 `isTypeSupported` 为 false
- **THEN** framework 在 Export panel 中禁用 Video 表单并向用户说明当前浏览器不支持视频导出

### Requirement: render 模式下 MP4 录制使用手动 requestFrame 驱动
当 exporter 为 `kind: 'render'` 且用户导出 MP4 时，framework SHALL 创建一个尺寸为 `contentWidth × contentHeight × scale` 的 framework 拥有 canvas，并通过 `captureStream(0)` + `videoTrack.requestFrame()` 手动驱动每一帧。framework MUST 按 `1000 / fps` 的间隔依次 await `renderFrame({ time, frameIndex })`，并 MUST 在最后一帧之后停止 MediaRecorder 再触发下载。

#### Scenario: 用户导出 30 fps × 5s 的 MP4
- **WHEN** 用户选择 fps = 30、duration = 5s 并确认
- **THEN** framework 总计调用 `renderFrame` 150 次，每次成功后调用 `videoTrack.requestFrame()`

#### Scenario: renderFrame 抛出异常
- **WHEN** 在录制过程中某次 `renderFrame` 抛出
- **THEN** framework 中止录制、停止 MediaRecorder、不下载部分文件，并在 UI 中向用户报告错误

### Requirement: 导出参数被 framework 约束在安全范围
Framework SHALL 在 Export panel 中限制可选导出参数：PNG `scale ∈ {1, 2, 4}`；MP4 `scale ∈ {1, 2, 4}`、`fps ∈ {24, 30, 60}`、`duration ∈ [1s, 30s]`。Framework MUST NOT 接受超出上述范围的输入。

#### Scenario: 用户尝试录制超过 30s 的 MP4
- **WHEN** 用户在 panel 中输入或选择 duration > 30s
- **THEN** framework 把该值钳制到上限并在 UI 中标注

#### Scenario: panel 默认值符合范围
- **WHEN** 用户首次切换到一个声明了 export 能力的 tool
- **THEN** framework 给出位于上述范围内的安全默认值（例如 PNG scale=1、MP4 scale=1 / fps=30 / duration=3s）

### Requirement: 导出文件命名遵循统一规则
Framework SHALL 为导出文件提供默认文件名 `<tool-id>-<yyyymmdd-hhmmss>.<ext>`，并 MUST 允许用户在 panel 中覆写文件名（不含扩展名）。扩展名 MUST 由 framework 根据实际格式决定，用户 MUST NOT 能修改扩展名。

#### Scenario: 用户使用默认文件名
- **WHEN** 用户未修改文件名直接确认导出
- **THEN** 下载的文件名形如 `noise-texture-creater-20260422-153012.png`

#### Scenario: 用户覆写文件名
- **WHEN** 用户在 panel 中把文件名覆写为 `marble-test`
- **THEN** 下载的文件名为 `marble-test.png`（或对应的 `.mp4` / `.webm`），扩展名仍由 framework 决定
