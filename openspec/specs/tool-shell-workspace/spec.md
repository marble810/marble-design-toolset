# tool-shell-workspace Specification

## Purpose
TBD - created by archiving change establish-pixel-tool-framework. Update Purpose after archive.
## Requirements
### Requirement: 工作区提供持久化壳层 Header
应用 SHALL 渲染一个共享工作区 Header，其中包含应用标题，以及用于打开工具、访问帮助、打开文档和打开设置的顶层操作入口。Docs 入口 SHALL 以新标签页打开独立文档浏览页面，而不替换当前工作区页面。

#### Scenario: 工作区壳层被渲染
- **WHEN** 应用在受支持视口中加载
- **THEN** Header 显示工作区标题以及 Open、Help、Docs、Settings 控件

#### Scenario: 从壳层进入设置
- **WHEN** 用户激活 Settings 控件
- **THEN** 工作区在不离开当前工作区上下文的情况下打开设置界面

#### Scenario: 从壳层打开文档页
- **WHEN** 用户激活 Docs 控件
- **THEN** 浏览器以新标签页打开独立文档浏览页面，并保留当前工作区页面状态不变

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
当工具选择使用 PreviewCanvas 时，PreviewCanvas SHALL 提供棋盘格背景、Fit 模式、1:1 模式、显式缩放控件、缩放百分比显示、拖拽平移和滚轮缩放能力。此能力仅在工具主动选择 PreviewCanvas 时生效。PreviewCanvas 对外显示的缩放百分比 MUST 表示设备像素归一化后的 logical zoom；当浏览器缩放或 `devicePixelRatio` 变化时，处于手动缩放状态的 PreviewCanvas MUST 保持当前 logical zoom 不变，并通过内部 render scale 调整继续表达同一用户可见缩放语义。处于 Fit 模式时，PreviewCanvas MAY 基于新的可用视口尺寸重新计算 fit zoom。PreviewCanvas MUST 以统一中心锚点处理内容定位，使 Fit、1:1 与手动缩放共享一致的几何参考。PreviewCanvas 在导航交互期间 MUST 避免文本被选中。

#### Scenario: 用户切换到 Fit 模式
- **WHEN** 用户在使用 PreviewCanvas 的工具中激活 Fit 控件
- **THEN** 预览舞台把当前预览缩放到可用视口范围内的最佳适配尺寸，并以设备像素归一化后的 logical zoom 表示该结果，同时维持中心锚点

#### Scenario: 用户请求实际尺寸预览
- **WHEN** 用户在使用 PreviewCanvas 的工具中激活 1:1 控件
- **THEN** 预览舞台按设备像素归一化后的实际比例显示内容，并维持中心锚点

#### Scenario: 用户手动浏览预览内容
- **WHEN** 用户在使用 PreviewCanvas 的工具中拖拽预览区域或通过滚轮进行缩放
- **THEN** 预览舞台更新平移或 logical zoom 状态，而不要求工具自行实现这类通用导航逻辑
- **THEN** 预览区不会触发文本选择高亮

#### Scenario: 手动缩放状态下浏览器缩放或 DPR 发生变化
- **WHEN** 使用 PreviewCanvas 的工具当前处于手动缩放状态，并在当前会话中遇到浏览器缩放变化或 `devicePixelRatio` 变化
- **THEN** 预览舞台保持当前 logical zoom 百分比不变，并重新计算内部 render scale 来维持同一用户可见缩放语义

#### Scenario: 工具不使用 PreviewCanvas
- **WHEN** 工具选择使用 FullStage 或自定义内容填充 RightPanel
- **THEN** 不提供共享的缩放/平移/适配导航 — 工具自行管理全部交互

### Requirement: 外置信息块不影响共享预览导航
当工具使用 PreviewCanvas 的外置信息块能力时，信息块 SHALL 保持与画布导航解耦。共享导航能力（Fit、1:1、显式缩放、滚轮缩放、拖拽平移）MUST 保持原有行为。

#### Scenario: 用户执行缩放与平移
- **WHEN** 用户在 viewport 中执行滚轮缩放或拖拽平移
- **THEN** 画布内容按既有规则变化，外置信息块保持贴合画布框右下锚点

#### Scenario: 工具启用外置信息块后继续使用共享导航
- **WHEN** 工具同时使用 PreviewCanvas 导航能力与外置信息块
- **THEN** Fit、1:1 与缩放百分比展示行为不发生回归

#### Scenario: 用户查看超长文本全文
- **WHEN** 用户 hover 或 focus 外置信息块中的被截断行以查看 tooltip
- **THEN** 该行为不改变 PreviewCanvas 的缩放与平移状态

### Requirement: 外置信息块遵循框架级不可选策略
PreviewCanvas 的外置信息块区域 MUST 默认不可选中，以保持与预览区一致的交互体验。

#### Scenario: 用户在信息块区域拖拽或误选文本
- **WHEN** 用户在信息块区域执行拖拽或文本选择动作
- **THEN** 不应出现可见文本选区，且不破坏预览区交互体验

### Requirement: 外置信息块超限输入以静默裁剪保持稳定
当工具传入超限或不完整信息块数据时，PreviewCanvas MUST 以静默裁剪策略维持稳定渲染；工作区不得因该输入进入错误态。

#### Scenario: 工具输入超过 5 行
- **WHEN** 工具向外置信息块传入超过 5 行内容
- **THEN** 工作区继续正常渲染，且仅展示规则允许范围内的内容

#### Scenario: 工具传入不完整首行配置
- **WHEN** 工具传入不完整的首行模式数据
- **THEN** PreviewCanvas 进行容错裁剪并保持工作区可用

### Requirement: 活动工具必须映射到 URL hash
工作区 SHALL 使用工具标识符把当前活动工具同步到 hash 路由中。

#### Scenario: 活动工具发生切换
- **WHEN** 用户激活另一个已打开的工具标签页
- **THEN** URL hash 更新为该工具的标识符

#### Scenario: 应用带有效工具 hash 加载
- **WHEN** 浏览器以有效工具 hash 打开工作区
- **THEN** 对应工具成为壳层中的活动工具

### Requirement: Tool 在 metadata 中声明导出能力
每个 tool SHALL 通过 `metadata.json` 中可选的 `export` 字段声明它向用户暴露的导出能力，结构为 `{ image?: boolean, video?: boolean }`，两个标志默认 `false`。Framework SHALL 仅当至少一个标志为 `true` 时在 LeftPanel 渲染 Export Section。声明该能力的 tool MUST 在其预览组件中通过 `getCanvasExportContext().register(...)` 注册一个匹配的 exporter；若运行时未注册，framework MUST 在 Export Section 中显示提示文字并使导出按钮 disabled。

#### Scenario: tool 未声明 export
- **WHEN** 一个 tool 的 `metadata.json` 不包含 `export` 字段或将两个标志均设为 false
- **THEN** LeftPanel 中不出现 Export Section

#### Scenario: tool 仅声明图片导出
- **WHEN** `metadata.export = { image: true }`
- **THEN** Export Section 中仅显示图片表单，且不出现 Image / Video tab 切换

#### Scenario: tool 同时声明图片与视频
- **WHEN** `metadata.export = { image: true, video: true }`
- **THEN** Export Section 顶部出现 Image / Video tab，默认选中 Image

#### Scenario: tool 声明了能力但未注册 exporter
- **WHEN** tool 在 metadata 中声明 export 但运行时尚未调用 register
- **THEN** Export Section 中所有导出按钮处于 disabled 状态，并显示一段提示文字说明 exporter 还未注册

### Requirement: Export Section 作为 LeftPanel 底部的 framework-owned 分块
当 active tool 在 metadata 中声明了任意导出能力时，framework SHALL 在 LeftPanel 的工具自定义 Section 之后渲染一个 framework-owned 的 `Export` Section（标题固定为 "Export"），且该 Section MUST 位于 LeftPanel 底部、所有 tool 自定义 Section 之下。Tool MUST NOT 通过 LeftPanel 的 children snippet 自行实现导出 UI；framework 注入的 Export Section 与 tool 注入的其他 Section MUST 并存且不互相覆盖。Export Section MUST 是嵌入式面板（不弹出 Dialog），所有参数控件、Export 按钮与导出结果提示均渲染在 Section 内部。

#### Scenario: tool 渲染多个自定义 Section
- **WHEN** tool 通过 LeftPanel children snippet 渲染了若干个 Section 且声明了 export 能力
- **THEN** Export Section 紧跟在 tool 自定义 Section 之后渲染，位置稳定不漂移

#### Scenario: 用户触发图片导出
- **WHEN** 用户在 Export Section 中调整 scale / 文件名后点击 Export Image
- **THEN** framework 在 Section 内调用导出流程，并在 Section 底部内联展示成功 / 失败结果，不弹出 Dialog

### Requirement: PreviewCanvas 不再承载导出 UI
PreviewCanvas 工具栏 MUST NOT 渲染 framework-owned 的 Export 按钮或 Dialog。导出 UI 已迁移至 LeftPanel 底部的 Export Section；PreviewCanvas 工具栏仅保留 Fit / 1:1 / 缩放控件以及 tool 通过 `actions` snippet 注入的自定义按钮。

#### Scenario: tool 使用 PreviewCanvas
- **WHEN** 一个声明了 export 能力的 tool 使用 PreviewCanvas
- **THEN** PreviewCanvas 工具栏中不出现 Export 按钮，导出操作仅通过 LeftPanel 的 Export Section 触发

#### Scenario: tool 使用 FullStage
- **WHEN** 一个声明了 export 能力的 tool 使用 FullStage 作为右侧呈现方式
- **THEN** Export Section 仍然出现在 LeftPanel 底部并可正常驱动导出，因为 export context 由 ToolShell 顶层提供，与右侧容器选择无关

