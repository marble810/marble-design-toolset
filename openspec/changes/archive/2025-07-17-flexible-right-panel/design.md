## 背景

Marble Design Toolset 工作区以两栏布局渲染每个工具：LeftPanel（参数区）和 RightPanel（预览区）。目前 RightPanel 是一个纯 flex 容器，但工具编写指南和全部 3 个现有工具都假设其唯一子组件为 `PreviewCanvas`——一个提供缩放/适配/平移控制、棋盘格背景以及对固定尺寸内容框执行 CSS `transform: scale()` 的组件。

这对静态 2D 预览（aspect-ratio、hello-world）有效，但产生以下问题：

- **WebGL/PixiJS 工具**：CSS transform scale 是像素拉伸而非真实分辨率变化。Three.js/PixiJS 管理自己的视口尺寸，需要完整的容器区域。
- **未来工具类型**（视频处理、动画预设、自由排版）需要截然不同的右侧面板体验——播放控制、全出血渲染或可滚动内容。
- 当前模式将所有工具耦合到单一呈现假设，降低了框架可扩展性。

来自 AGENTS.md 的约束：布局组件手写（不用 Bits UI），RightPanel 是框架拥有的壳层，工具在壳层 slot 内渲染内容，仅使用 CSS Custom Properties + px 单位。

## 目标 / 非目标

**目标：**
- RightPanel 成为灵活容器，工具可用任何内容策略填充
- PreviewCanvas 作为可选壳层组件保留，供 2D 预览工具使用
- 新增 FullStage 组件为 WebGL/视频/交互工具提供最小化全出血容器
- PreviewCanvas 移除 `.pixel-frame` 边框以产生更干净、更融合的视口
- 现有工具完成迁移（three-cube → FullStage；hello-world 和 aspect-ratio 保持 PreviewCanvas）
- 更新框架文档和规格

**非目标：**
- AnimationPlayer 组件（推迟到未来变更）
- 播放/时间轴控制
- 导出功能（按用户决策保留在 LeftPanel）
- 响应式/移动端布局变更
- LeftPanel、ToolShell 网格或 Header 的变更

## 决策

### 决策 1：RightPanel 仅提供视觉基线

**选择**：RightPanel 获得 `background: var(--color-bg-panel)` 并保持 flex 容器。不强制任何子组件结构要求。

**考虑的替代方案**：
- *结构化布局（toolbar slot + 主区域）*：否决，因为工具需要根本不同的顶部区域（缩放栏 vs. 播放栏 vs. 无）。通用 slot 增加复杂度但不增加价值——工具自行组合内部结构。
- *零视觉贡献*：否决，因为一致的背景色可防止工具透明或稀疏内容时出现视觉「空洞」。

**理由**：最简单的契约。工具导入所需的壳层组件（PreviewCanvas、FullStage 或原始 HTML）并放入 RightPanel。视觉基线确保无论内容策略如何，都有一致的深色背景。

### 决策 2：PreviewCanvas 移除 `.pixel-frame`，保留内部工具栏

**选择**：移除 PreviewCanvas 的 `.pixel-frame` border-image 装饰。保留现有工具栏（label + zoom% + Fit/1:1/±）。

**考虑的替代方案**：
- *通过 prop 使边框可配置*：增加了复杂度，该装饰与无缝面板目标视觉上冲突。
- *同时移除工具栏*：否决，缩放/适配控制是 PreviewCanvas 的核心价值主张。

**理由**：pixel-frame 边框产生视觉上的「框中框」效果，感觉沉重。移除后让 PreviewCanvas 与 RightPanel 背景融为一体。工具栏是 PreviewCanvas 的功能身份——没有它，工具还不如直接渲染原始内容。

### 决策 3：PreviewCanvas 工具栏获得 `actions` snippet slot

**选择**：添加可选的 `actions` snippet prop，在内置缩放按钮之后渲染额外控件。

**理由**：CSS 排版工具等可能需要「网格开关」或「标尺开关」在工具栏中。Snippet slot 是最轻量的补充——无新组件、无新抽象，只是一个渲染点。

### 决策 4：新增 `FullStage` 组件

**选择**：在 `src/lib/components/shell/full-stage/` 下手写壳层组件。实现：`<div class="full-stage">{@render children?.()}</div>`，样式为 `flex: 1 1 auto; min-width: 0; min-height: 0; overflow: hidden; position: relative;`。

**考虑的替代方案**：
- *直接让工具在 RightPanel 中渲染原始内容*：可行，但命名组件可以文档化意图，提供一致的 overflow/sizing 契约，且在导入中可被发现。
- *FullStage 带 ResizeObserver*：否决，需要尺寸信息的工具（WebGL）已经在自己的 canvas 元素上使用 ResizeObserver。框架级观察增加耦合但不减少工具工作量。

**理由**：FullStage 刻意保持最小化。其价值在于命名（意图文档化）、一致的 `overflow: hidden` + `position: relative`（用于绝对定位子元素），以及一个信号「此工具拥有整个右侧面板区域」的单一导入。

### 决策 5：three-cube 迁移到 FullStage

**选择**：three-cube 移除 PreviewCanvas 包装层，将 `<CubeViewport />` 渲染在 `<FullStage>` 内。CubeViewport 现有的 ResizeObserver 自然填满舞台。

**理由**：当前 CSS transform scale 在 Three.js canvas 上会在缩放时产生模糊渲染。FullStage 让 Three.js 直接控制渲染尺寸。

## 风险 / 权衡

- **[视觉不一致]** → 每个工具不同的右侧面板体验可能感觉割裂。缓解：RightPanel 的背景色提供最低一致性；未来设计评审可按需添加共享装饰。
- **[模式蔓延]** → 工具可能发明临时性的右侧面板布局，难以维护。缓解：在工具编写指南中文档化推荐模式（PreviewCanvas 用于 2D，FullStage 用于全出血，自由内容用于边缘场景）。
- **[破坏现有工具]** → PreviewCanvas API 变更和迁移工作量。缓解：全部 3 个工具均为第一方，将在同一变更中完成迁移。
