# tool-shell-workspace Specification

## Purpose
TBD - created by archiving change establish-pixel-tool-framework. Update Purpose after archive.
## Requirements
### Requirement: 工作区提供持久化壳层 Header
应用 SHALL 渲染一个共享工作区 Header，其中包含应用标题，以及用于打开工具、访问帮助和打开设置的顶层操作入口。

#### Scenario: 工作区壳层被渲染
- **WHEN** 应用在受支持视口中加载
- **THEN** Header 显示工作区标题以及 Open、Help、Settings 控件

#### Scenario: 从壳层进入设置
- **WHEN** 用户激活 Settings 控件
- **THEN** 工作区在不离开当前工作区上下文的情况下打开设置界面

### Requirement: 工具通过可打开与可关闭的标签页管理
工作区 SHALL 将已打开工具表示为标签页，允许单独关闭标签页，并从本地持久化中恢复已打开标签集合和活动标签。

#### Scenario: 从工作区中打开一个工具
- **WHEN** 用户通过工作区壳层打开一个工具
- **THEN** 该工具出现在标签栏中并成为活动标签

#### Scenario: 用户关闭全部标签页
- **WHEN** 最后一个剩余标签页被关闭
- **THEN** 工作区显示空状态引导，而不是保留陈旧的工具内容

#### Scenario: 工作区重新加载
- **WHEN** 应用在此前已打开若干标签页后重新加载
- **THEN** 除非有效 URL hash 指向另一个工具，否则壳层从本地持久化恢复此前的已打开标签页和活动标签

### Requirement: 工具必须渲染在严格的壳层布局中
工作区 SHALL 在框架拥有的左右面板布局中渲染工具内容，其中左面板以框架拥有的 MainInfo 区块开头，右面板承载工具自选的内容呈现方式。

#### Scenario: 工具渲染左侧参数区
- **WHEN** 某个工具挂载到壳层中
- **THEN** 它的左侧内容出现在框架拥有的 MainInfo 区块之后，该区块展示工具标题、描述、菜单动作和 About 入口

#### Scenario: 工具渲染右侧内容
- **WHEN** 某个工具挂载到壳层中
- **THEN** 它的右侧内容渲染在 RightPanel 内部，工具自行选择使用 PreviewCanvas、FullStage 或自定义内容来填充 RightPanel，而不是被强制使用特定的预览舞台组件

### Requirement: 左面板使用可配置的工作区设置
工作区 SHALL 允许用户以 viewport-width 数值配置左面板宽度，并将该设置持久化到本地。

#### Scenario: 用户修改左面板宽度
- **WHEN** 用户在设置界面保存新的左面板宽度
- **THEN** 左面板更新为该 viewport 宽度值，并且该值被本地持久化

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

### Requirement: 活动工具必须映射到 URL hash
工作区 SHALL 使用工具标识符把当前活动工具同步到 hash 路由中。

#### Scenario: 活动工具发生切换
- **WHEN** 用户激活另一个已打开的工具标签页
- **THEN** URL hash 更新为该工具的标识符

#### Scenario: 应用带有效工具 hash 加载
- **WHEN** 浏览器以有效工具 hash 打开工作区
- **THEN** 对应工具成为壳层中的活动工具

