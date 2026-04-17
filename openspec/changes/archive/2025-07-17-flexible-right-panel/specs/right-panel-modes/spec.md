## ADDED Requirements

### Requirement: RightPanel 提供视觉基线但不强制结构约束
RightPanel SHALL 渲染一个带 `background: var(--color-bg-panel)` 的 flex 容器，且不强制任何子组件结构要求。工具 MAY 在 RightPanel 内直接放置任意内容。

#### Scenario: 工具在 RightPanel 中渲染自由内容
- **WHEN** 工具在 RightPanel 内直接渲染自定义 HTML 元素，不使用 PreviewCanvas 或 FullStage
- **THEN** 内容出现在一个带面板背景色的 flex 容器中，且不存在工具栏、棋盘格或缩放控制

### Requirement: PreviewCanvas 是用于 2D 内容预览的可选壳层组件
PreviewCanvas SHALL 为固定尺寸的 2D 内容提供缩放/适配/平移控制、棋盘格视口和基于 CSS transform 的缩放。工具 MUST 在 RightPanel 内显式导入并渲染 PreviewCanvas 才能使用这些能力。

#### Scenario: 工具选择 PreviewCanvas 进行 2D 预览
- **WHEN** 工具在 RightPanel 内渲染 PreviewCanvas，并传入 contentWidth 和 contentHeight
- **THEN** 预览视口以适配/缩放/平移控制和棋盘格背景显示工具内容

#### Scenario: 工具不使用 PreviewCanvas
- **WHEN** 工具在 RightPanel 内渲染内容但未使用 PreviewCanvas
- **THEN** 不应用缩放控制、棋盘格背景或 transform 缩放

### Requirement: PreviewCanvas 不使用 pixel-frame 边框装饰
PreviewCanvas SHALL NOT 应用 `.pixel-frame` border-image 装饰。组件 MUST 以干净的边缘渲染，与 RightPanel 背景融合。

#### Scenario: PreviewCanvas 视觉融合
- **WHEN** PreviewCanvas 在 RightPanel 中渲染
- **THEN** PreviewCanvas 容器上不显示 border-image 或外层像素边框

### Requirement: PreviewCanvas 工具栏支持通过 snippet slot 添加自定义操作
PreviewCanvas SHALL 接受可选的 `actions` snippet prop，在工具栏区域的内置缩放/适配按钮之后渲染额外控件。

#### Scenario: 工具添加自定义工具栏操作
- **WHEN** 工具向 PreviewCanvas 传递 actions snippet
- **THEN** 自定义操作在缩放控制之后渲染在工具栏中

#### Scenario: 未提供自定义操作
- **WHEN** 工具使用 PreviewCanvas 但不传递 actions snippet
- **THEN** 工具栏仅渲染默认的标签、缩放百分比和缩放/适配控制

### Requirement: FullStage 提供最小化全出血容器
FullStage SHALL 是手写壳层组件，提供一个填满整个 RightPanel 区域的全出血容器。它 MUST 设置 `flex: 1`、`overflow: hidden` 和 `position: relative`。它 SHALL NOT 提供缩放控制、工具栏或背景装饰。

#### Scenario: WebGL 工具使用 FullStage
- **WHEN** 工具在 FullStage 内渲染 WebGL canvas
- **THEN** canvas 元素可填满整个可用区域并自行管理视口尺寸

#### Scenario: FullStage 不施加视觉装饰
- **WHEN** FullStage 在 RightPanel 中渲染
- **THEN** 不存在工具栏、棋盘格、缩放控制或边框装饰——仅可见工具自己的内容

### Requirement: 壳层 index 导出所有右侧面板容器组件
壳层组件桶导出（`src/lib/components/shell/index.ts`）SHALL 导出 PreviewCanvas、FullStage 和 RightPanel，使工具可以从单一路径导入任意组合。

#### Scenario: 工具从壳层 index 导入 FullStage
- **WHEN** 工具文件从 `$lib/components/shell/index.js` 导入 `{ FullStage }`
- **THEN** 导入正确解析到 FullStage 组件且无错误
