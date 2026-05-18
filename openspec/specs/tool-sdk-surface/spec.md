# tool-sdk-surface Specification

## Purpose
TBD - created by archiving change stabilize-tool-sdk-surface. Update Purpose after archive.
## Requirements
### Requirement: Framework 提供稳定的 tool SDK 入口
Framework SHALL 提供一组面向 tool 作者的稳定 SDK 入口，用于暴露 ToolDefinition 相关类型、runtime context 读取入口以及共享宿主 capability 的推荐接入点。新的 tool 和更新后的作者文档 MUST 以该 SDK 入口作为默认导入路径，而不是直接依赖 framework internal 模块路径。

#### Scenario: 新工具接入宿主能力
- **WHEN** 作者创建一个新的 tool 并需要读取 runtime context、接入 source input 或 render host helper
- **THEN** 脚手架和作者文档提供的默认示例从稳定 SDK 入口导入这些能力

#### Scenario: Framework internal 结构重组
- **WHEN** framework 调整内部 runtime 模块结构但未改变 tool-facing contract
- **THEN** 依赖稳定 SDK 入口的 tool 不需要跟随内部模块路径变化一起修改

### Requirement: Tool SDK 明确区分 public API 与 internal implementation
Framework MUST 明确哪些入口属于 public tool API，哪些模块仅供 framework internal 使用。Public API 的迁移和弃用 MUST 有显式策略；internal implementation 的重构 MUST NOT 被当作 tool contract 的一部分。

#### Scenario: 作者查找可安全依赖的能力
- **WHEN** 作者阅读 tool 开发文档或脚手架生成代码
- **THEN** 可以明确分辨 public tool API 与不推荐直接依赖的 internal 模块

#### Scenario: Public API 发生弃用
- **WHEN** framework 需要调整某个 public tool API 入口
- **THEN** 文档和迁移说明提供显式的替代路径，而不是仅通过内部重构隐式打破现有 tool

