## ADDED Requirements

### Requirement: Tool IO 作为默认推荐的文件来源入口
Tool IO SHALL 作为 tool 作者接入本地文件来源 workflow 的默认推荐入口。作者文档、脚手架和共享示例在默认情况下 MUST 优先使用 tool IO facade 与其 UI 层，而不是要求作者先理解底层 file input pipeline 的内部结构。

#### Scenario: 作者阅读文件输入文档
- **WHEN** 作者查找如何为 tool 接入本地文件来源
- **THEN** 文档首先介绍 tool IO facade 和可选 UI 层，并把底层 pipeline 作为高级自定义路径说明

#### Scenario: 脚手架生成带文件来源的工具
- **WHEN** 脚手架生成需要 picker 或 drop 的 recipe
- **THEN** 生成代码默认从 tool IO facade 与其 UI 组件起步

### Requirement: Tool IO 明确 facade 层与 UI 层职责
Tool IO MUST 明确区分 tool-facing facade 与可选 UI layer。Tool 可以只使用 facade 自行绘制 UI，也可以同时复用 `SourceInputSection`、`DropZone` 等共享组件；framework MUST NOT 强制 tool 使用某个固定 UI 实现。

#### Scenario: Tool 只使用 facade
- **WHEN** 一个 tool 需要自定义来源 UI，但仍想复用共享 source workflow
- **THEN** 它可以只使用 tool IO facade，而不导入共享 UI 组件

#### Scenario: Tool 同时使用 facade 和共享 UI
- **WHEN** 一个 tool 想快速接入标准 source 区块和拖放区域
- **THEN** 它可以将同一个 source workflow 传给共享 UI 组件，且不需要自行拼装第二套状态
