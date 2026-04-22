## ADDED Requirements

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
