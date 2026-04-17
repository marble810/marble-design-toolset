## MODIFIED Requirements

### Requirement: 工具必须渲染在严格的壳层布局中
工作区 SHALL 在框架拥有的左右面板布局中渲染工具内容，其中左面板以框架拥有的 MainInfo 区块开头，右面板承载工具自选的内容呈现方式。

#### Scenario: 工具渲染左侧参数区
- **WHEN** 某个工具挂载到壳层中
- **THEN** 它的左侧内容出现在框架拥有的 MainInfo 区块之后，该区块展示工具标题、描述、菜单动作和 About 入口

#### Scenario: 工具渲染右侧内容
- **WHEN** 某个工具挂载到壳层中
- **THEN** 它的右侧内容渲染在 RightPanel 内部，工具自行选择使用 PreviewCanvas、FullStage 或自定义内容来填充 RightPanel，而不是被强制使用特定的预览舞台组件

### Requirement: 预览舞台提供共享导航能力
当工具选择使用 PreviewCanvas 时，PreviewCanvas SHALL 提供棋盘格背景、Fit 模式、1:1 模式、显式缩放控件、缩放百分比显示、拖拽平移和滚轮缩放能力。此能力仅在工具主动选择 PreviewCanvas 时生效。

#### Scenario: 用户切换到 Fit 模式
- **WHEN** 用户在使用 PreviewCanvas 的工具中激活 Fit 控件
- **THEN** 预览舞台把当前预览缩放到可用视口范围内的最佳适配尺寸

#### Scenario: 用户请求实际尺寸预览
- **WHEN** 用户在使用 PreviewCanvas 的工具中激活 1:1 控件
- **THEN** 预览舞台按预览逻辑内容的实际比例显示内容

#### Scenario: 用户手动浏览预览内容
- **WHEN** 用户在使用 PreviewCanvas 的工具中拖拽预览区域或通过滚轮进行缩放
- **THEN** 预览舞台更新平移或缩放状态，而不要求工具自行实现这类通用导航逻辑

#### Scenario: 工具不使用 PreviewCanvas
- **WHEN** 工具选择使用 FullStage 或自定义内容填充 RightPanel
- **THEN** 不提供共享的缩放/平移/适配导航 — 工具自行管理全部交互
