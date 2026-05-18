## ADDED Requirements

### Requirement: Tool runtime 公共能力通过稳定 SDK 暴露
Tool runtime SHALL 为 tool 作者提供稳定的公共能力入口，使 tool 可以在保持现有目录 schema 和运行时定义 contract 不变的前提下，通过稳定 SDK 读取 runtime context、共享 capability 和推荐 helper。Framework MUST NOT 要求 tool 直接依赖深层 internal 模块路径才能完成标准接入。

#### Scenario: Tool 使用稳定 SDK 读取运行时服务
- **WHEN** 一个新 tool 需要读取自身 `toolId`、session active 状态或共享 capability
- **THEN** 它可以通过稳定 SDK 完成接入，而无需直接导入 framework internal 模块

#### Scenario: 旧 tool 未迁移到稳定 SDK
- **WHEN** 一个现有 tool 仍然使用历史导入路径
- **THEN** 在兼容窗口内该 tool 继续可加载和渲染，且不因本次 change 被立即打破
