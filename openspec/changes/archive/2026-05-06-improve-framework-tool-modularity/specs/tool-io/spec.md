## ADDED Requirements

### Requirement: Framework 提供 tool-facing IO facade
Framework SHALL 提供一个面向 tool 作者的一体化 IO facade。该 facade MUST 从单一稳定入口暴露文件来源 workflow、drop 绑定、SourceInputSection 所需状态、文件摘要、错误状态、清理入口和下载 primitive，使 tool 无需在每个模块中重复拼装低层 file-input controller、drop helper 和 Source UI glue code。

#### Scenario: Tool 创建文件来源 workflow
- **WHEN** tool 需要导入 image、video 或 text 文件作为来源
- **THEN** tool 可以通过 tool IO facade 创建一个 source workflow，并从同一对象读取 accept、current item、busy、last error、pick、clear、dispose 和 drop ingest 能力

#### Scenario: Tool 使用单一导入入口
- **WHEN** tool 接入文件来源、drop zone 和 source section UI
- **THEN** tool 从 tool IO facade 导入所需 API，而不是分别从 file-input runtime、drop helper、私有 formatter 和私有 UI 中拼装

#### Scenario: Tool 不需要高层 IO facade
- **WHEN** tool 有特殊 IO 需求并选择直接使用底层 file-input runtime
- **THEN** 底层 file-input runtime 仍保持可用，且行为不被高层 facade 改变

### Requirement: Tool IO source workflow 复用 file-input pipeline
Tool IO source workflow MUST 复用现有 file-input pipeline 的类型判定、读取、错误语义和 object URL 清理责任。Tool IO MUST NOT 创建第二套文件类型推断、媒体元信息读取或临时 URL 生命周期实现。

#### Scenario: Source workflow ingest 成功
- **WHEN** 用户通过 picker 或 drop 提交受支持文件
- **THEN** source workflow 使用 file-input pipeline 生成标准化 ImportedFileItem，并更新当前来源状态

#### Scenario: Source workflow ingest 失败
- **WHEN** 用户提交空选择、多个文件或不受支持的文件类型
- **THEN** source workflow 暴露 file-input pipeline 的稳定错误状态，并保留最近一次成功来源

#### Scenario: Tool 销毁 source workflow
- **WHEN** tool 调用 source workflow 的 dispose 入口或组件卸载
- **THEN** source workflow 释放由 file-input pipeline 管理的 object URL

### Requirement: Tool IO 提供 SourceInputSection 与 DropZone 绑定
Tool IO SHALL 提供 SourceInputSection 和 DropZone 的调用层绑定，使两者可以消费同一个 source workflow。SourceInputSection MUST 渲染 Browse/Replace/Clear、文件摘要、busy 和 error 状态；DropZone MUST 统一 drag-over、drag-leave containment 和 drop ingest 行为。

#### Scenario: SourceInputSection 消费 source workflow
- **WHEN** tool 把 source workflow 传给 SourceInputSection
- **THEN** SourceInputSection 根据 workflow 状态显示空态、已导入文件、busy、错误、Replace 和 Clear 控件

#### Scenario: DropZone 消费 source workflow
- **WHEN** tool 把 source workflow 绑定到 DropZone
- **THEN** DropZone 在 drop 时调用同一 workflow 的 ingest 入口，并在 drag 状态变化时提供稳定 active 状态

#### Scenario: Picker 与 drop 共享处理路径
- **WHEN** 同一个 source workflow 同时接收 Browse 和 Drop 输入
- **THEN** 两种输入都走同一 file-input validation 与 read path

### Requirement: Tool IO 提供可复用文件摘要与下载 primitive
Tool IO SHALL 提供可复用的文件摘要 helper 和 Blob 下载 primitive。文件摘要 helper MUST 支持 image、video 和 text 的通用展示字段；下载 primitive MAY 被 canvas export runtime 复用，但 canvas export 的 frame source、编码、capability 和 job 状态 MUST 继续保留在 tool-canvas-export capability 中。

#### Scenario: Tool 展示导入文件摘要
- **WHEN** SourceInputSection 或 tool 需要展示 ImportedFileItem
- **THEN** tool IO 提供稳定的名称、尺寸、大小、类型和时长摘要字段

#### Scenario: Export runtime 触发下载
- **WHEN** canvas export runtime 需要下载 Blob
- **THEN** 它可以复用 tool IO 的下载 primitive，而不把 canvas export pipeline 整体移动进 tool IO

#### Scenario: Workspace 恢复状态
- **WHEN** workspace 读取 hash 或 localStorage 以恢复标签页
- **THEN** 该 persistence 行为仍属于 workspace runtime，不属于 tool IO facade