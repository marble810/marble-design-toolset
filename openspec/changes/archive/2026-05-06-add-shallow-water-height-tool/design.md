## Context

Marble Design Toolset 已提供工具目录发现、可选 heavy tech stack 懒加载、统一 file input pipeline、PreviewCanvas 和 canvas export runtime。新增工具需要遵守框架拥有 workspace shell 的边界：工具只渲染 LeftPanel 参数区和 RightPanel 预览区，不重建顶层壳层。

本工具的输入是本地黑白图像，输出是浅水高度场的黑白动画。用户已确认首版采用“线性浅水波 + 阻尼”，并要求波到达画布边缘时被销毁，不出现反射行为。

## Goals / Non-Goals

**Goals:**

- 创建 `src/tools/shallow-water-height/` 工具，目录 schema 符合 tool-module-runtime 规范。
- 使用 `three` 的 GPU render target / shader pipeline 计算高度场动画。
- 使用统一 file input pipeline 接收单张图像，生成初始高度图。
- 使用线性浅水波/高度场模型、全局阻尼和吸收边界输出稳定可控的黑白高度动画。
- 使用 PreviewCanvas 展示固定尺寸 2D 预览，并通过 `render` exporter 支持 PNG 和视频导出。

**Non-Goals:**

- 不实现完整非线性 Saint-Venant / 守恒型 SWE、Lax-Friedrichs 通量、干湿边界或地形坡度。
- 不实现彩色真实水面材质、折射、反射、法线贴图或 3D 水面网格。
- 不引入新的 npm 依赖，不实现独立 MP4/PNG 编码或下载逻辑。
- 不修改共享 shell、PreviewCanvas、file input 或 canvas export runtime 的契约。

## Decisions

### 使用 Three.js 而不是 PixiJS

工具在 `index.ts` 声明 `techStack: ['three']`。Three.js 的 WebGLRenderer、ShaderMaterial、WebGLRenderTarget 与 GPUComputationRenderer 风格的 ping-pong 纹理工作流更适合规则网格数值迭代。PixiJS 更适合 2D sprite/filter 合成，但对多状态浮点纹理模拟的本地范式不如 Three.js 直接。

备选方案：使用 PixiJS Filter ping-pong。放弃原因是状态纹理、离屏浮点 render target、确定性导出帧的组织成本更高。

### 使用固定 2D PreviewCanvas，而不是 FullStage

右侧内容使用 `RightPanel` + `PreviewCanvas`。输出本质是固定分辨率黑白高度图，PreviewCanvas 的 fit、1:1、缩放和平移正好匹配画布检查工作流。

备选方案：使用 FullStage 承载 WebGL canvas。放弃原因是 FullStage 更适合全出血 3D/交互舞台；本工具需要固定内容尺寸与导出尺寸一致。

### 数值模型采用线性浅水波/高度场模型

状态纹理使用 RGBA 浮点或半浮点数据：`R = 当前高度 eta`，`G = 上一帧高度 etaPrev`，`B/A` 预留给 mask 或辅助数据。compute shader 使用离散 Laplacian 更新：

```text
etaNext = 2 * eta - etaPrev + waveSpeed^2 * dt^2 * laplacian(eta)
etaNext *= damping
etaNext *= edgeAbsorbMask
```

`edgeAbsorbMask` 在画布边缘吸收带内从 1 平滑衰减到 0，使波能量到边缘后逐步消失，避免反射边界。

备选方案：完整守恒型 SWE。放弃原因是首版艺术工具不需要激波、水跃、非线性通量和干湿边界，且它们会显著增加不稳定和调参成本。

### 导出采用 render exporter

工具声明 `metadata.export = { image: true, video: true }`，运行时在组件初始化期读取 `getCanvasExportContext()`，挂载后注册 `kind: 'render'` exporter。`renderFrame({ canvas, time, frameIndex })` 根据当前参数和输入图像确定性地渲染目标帧。

导出路径不直接捕获预览 canvas，而是使用 framework 提供的离屏 canvas。这样 PNG 和视频导出尺寸由 `contentWidth/contentHeight` 与 scale 决定，视频帧由 framework 的 `captureStream(0)` + `requestFrame()` 手动驱动。

备选方案：注册 `kind: 'canvas'` 抓取预览 canvas。放弃原因是 WebGL preview canvas 的 drawing buffer、RAF 时间轴和录制节奏更容易造成空帧或非确定输出。

### 导出帧采用可重放模拟

工具维护一份从输入图像生成的初始高度数据。预览可以持续推进；导出时使用独立 renderer/simulator 或重置同一 simulator 到初始状态，再按 `frameIndex` 推进固定步数。导出必须避免依赖当前预览已播放到的时间。

## Risks / Trade-offs

- [Risk] 浏览器不支持 float render target 或相关 WebGL 扩展 → Mitigation: 初始化失败时在预览区显示错误信息，并保持左侧输入与参数 UI 可用。
- [Risk] 高分辨率和高每帧步数导致预览卡顿 → Mitigation: 默认 256 网格、较低每帧步数，并把分辨率选项限制为 128/256/512。
- [Risk] 导出时逐帧重放模拟耗时较长 → Mitigation: 使用固定步进和 render exporter 保证确定性，优先正确性；导出时由框架已有进度/状态承担用户反馈。
- [Risk] 初始黑白图像极端高频导致闪烁或不稳定 → Mitigation: 默认振幅和波速取保守范围，并在 shader 内钳制高度。
- [Risk] 吸收边界过窄会残留边缘能量 → Mitigation: 暴露 `Edge Absorb` 控制并设置安全默认值。
