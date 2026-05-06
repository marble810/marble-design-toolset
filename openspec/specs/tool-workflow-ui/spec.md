# tool-workflow-ui Specification

## Purpose
定义 tool 左侧工作流参数 UI 的共享原子组件契约，让字段、枚举、布尔、模式切换和预设选择复用同一套项目 UI 语言。

## Requirements

### Requirement: Framework 提供共享的 tool field UI 原子
Framework SHALL 提供可复用的 tool field UI 原子，覆盖 Field wrapper、SelectField、CheckboxField、SegmentedControl 与 PresetGrid。上述组件 SHALL 使用项目共享 UI 令牌和 px 单位，并 SHALL 保持英文共享文案。

#### Scenario: Tool 渲染选择型参数
- **WHEN** tool 使用共享 SelectField 渲染枚举参数
- **THEN** 该字段显示 label、当前值和可选项，并通过回调把选中的 typed value 传回 tool

#### Scenario: Tool 渲染二元参数
- **WHEN** tool 使用共享 CheckboxField 渲染布尔参数
- **THEN** 该字段显示 checked 状态，并在用户切换时通过回调传出新的布尔值

#### Scenario: Tool 渲染模式切换
- **WHEN** tool 使用共享 SegmentedControl 渲染少量互斥模式
- **THEN** 当前模式以 active 状态展示，用户选择另一项时回调传出对应 value

#### Scenario: Tool 渲染预设网格
- **WHEN** tool 使用共享 PresetGrid 渲染一组选项预设
- **THEN** 当前预设以 active 状态展示，每个预设可以提供 label、value 和可选 title

### Requirement: Workflow UI 与 tool IO 保持边界清晰
共享 workflow UI SHALL 专注于参数输入、预设选择和字段状态展示。文件来源、drop、object URL 生命周期和下载 primitive SHALL 由 tool IO capability 提供，workflow UI MUST NOT 重复实现这些 IO 工作流。

#### Scenario: Tool 需要文件来源 UI
- **WHEN** tool 需要 Browse/Replace/Clear、drop 或文件摘要能力
- **THEN** tool 使用 tool IO capability，而不是在 workflow UI 中寻找另一套文件输入实现

#### Scenario: Tool 需要普通参数字段
- **WHEN** tool 只需要枚举、布尔、模式切换、预设或 hint/error 字段展示
- **THEN** tool 使用共享 workflow UI 组件