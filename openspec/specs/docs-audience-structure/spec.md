# docs-audience-structure Specification

## Purpose
TBD - created by archiving change restructure-docs-by-audience. Update Purpose after archive.
## Requirements
### Requirement: Docs 顶层结构按读者角色分组
仓库 docs SHALL 使用 audience-first 的顶层目录结构，至少包含 `for-framework-developers/` 与 `for-tool-developers/` 两个主要分组。Framework developer 文档 SHALL 面向框架维护、runtime、shell、SDK surface、OpenSpec 和 docs system；tool developer 文档 SHALL 面向 tool 创建、recipes、public SDK、IO、export、渲染技术栈和共享 UI 使用。

#### Scenario: Framework developer 查找框架维护文档
- **WHEN** framework developer 打开 docs 目录或 `/docs`
- **THEN** 可以从 `for-framework-developers/` 入口进入框架维护相关文档

#### Scenario: Tool developer 查找工具开发文档
- **WHEN** tool developer 打开 docs 目录或 `/docs`
- **THEN** 可以从 `for-tool-developers/` 入口进入 tool 创建、recipe 和 public SDK 使用文档

### Requirement: 同一 capability 的文档按角色拆分视角
当同一 capability 同时影响 framework developer 和 tool developer 时，docs SHALL 按读者角色拆分视角。Tool-facing 文档 MUST 描述如何使用 public API；framework-facing 文档 MUST 描述 contract、维护边界和演进策略。

#### Scenario: Public SDK 文档被拆分
- **WHEN** 文档解释 public SDK
- **THEN** tool developer 文档说明如何导入和使用 SDK，framework developer 文档说明如何维护 public/internal 边界与兼容策略

#### Scenario: IO capability 文档被拆分
- **WHEN** 文档解释文件输入能力
- **THEN** tool developer 文档优先说明 source facade 和共享 UI，framework developer 文档说明底层 file-input pipeline、facade 分层和维护责任

### Requirement: README 只保留角色入口与最短路径
README SHALL 只保留项目定位、核心开发命令、两类文档入口和最短 tool 创建路径。README MUST NOT 指向已删除文档路径，且 SHOULD 将详细架构说明下沉到 `for-framework-developers/`。

#### Scenario: 用户从 README 查找文档
- **WHEN** 用户阅读 README 的文档入口
- **THEN** README 指向 `for-framework-developers/` 与 `for-tool-developers/` 两类入口，而不是旧的混合 `guides/Making Tools` 路径

#### Scenario: 架构文档路径已经变化
- **WHEN** 旧架构文档路径不再存在
- **THEN** README 不再引用该路径，并提供新的 framework developer 文档入口

