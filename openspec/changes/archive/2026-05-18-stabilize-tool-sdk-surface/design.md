## Context

当前 tool 运行时能力已经覆盖 metadata、runtime context、source input、render host、canvas export 等核心宿主能力，但这些能力分散在多个 `$lib/runtime/*`、`$lib/components/*` 和 type 定义中。对 framework 维护者来说这是自然的内部结构；对 tool 作者来说，这意味着“哪些是稳定入口、哪些只是当前实现细节”并不清晰。

项目当前仍以仓库内插件为主，而不是第三方分发插件平台，因此本次设计不需要引入独立 npm package、远程安装或复杂版本协商；但它需要先把 repo 内的 public tool API 收口成稳定边界，避免后续 runtime 重构继续扩散到所有 tool。

## Goals / Non-Goals

**Goals:**
- 为 tool 作者提供清晰、稳定、可文档化的 SDK surface。
- 保持 framework internal 模块可继续重构，不要求 tool 直接依赖内部路径。
- 让脚手架、文档和后续 recipe 都基于同一套 public API 组织。
- 在不破坏现有 tool schema 的前提下，为后续兼容性语义预留位置。

**Non-Goals:**
- 不把仓库改造成独立分发的第三方插件平台。
- 不修改 `src/tools/<tool-id>/` 的目录 schema。
- 不限制 tool 的内部组件拆分、状态管理或渲染实现方式。
- 不在本次中重写所有现有 tool；迁移以兼容优先。

## Decisions

### 决策 1：引入 repo-local 的 public tool SDK 入口

新增一层明确的 tool-facing SDK surface，统一承载：
- ToolDefinition / metadata 相关类型
- runtime context 读取入口
- source input / export / render host 等推荐接入点
- 与 tool shell 组合直接相关的公共 helper

选择 repo-local public surface，而不是拆成独立包，是因为当前项目仍然是单仓库内插件模式；过早抽成外部 package 会放大维护面，但不增加实际收益。

### 决策 2：保留 internal 模块，但将其降级为 framework-only implementation detail

现有 `$lib/runtime/*` 内部结构会继续存在，但文档、脚手架和 recipe 不再把这些内部路径作为默认示例。对于已经存在的 tool，保留兼容导入路径作为过渡；新的推荐用法只走 public SDK。

相较于一次性强制迁移全部 tool，这种分层迁移能更快把边界稳定下来，同时避免现有工具因为 API 收口而被迫大改。

### 决策 3：兼容性语义先以“稳定入口 + 显式迁移策略”实现，而不是立刻引入复杂版本系统

本次先定义：
- 哪些模块属于 public tool API
- 哪些模块属于 internal
- public API 变更时如何迁移和弃用

不立刻引入独立 semver 包管理或双向协商协议。当前仓库体量和协作模式还不足以支撑更重的版本治理；先把边界收口清楚，比先发明复杂版本机制更有效。

### 决策 4：脚手架和文档必须优先消费 public SDK

只定义 public API 而不让脚手架、文档和 recipe 率先使用它，边界会再次漂移。因此本次设计把 scaffold/docs 当作第一批 SDK 消费者，用它们来反向约束 public surface 是否足够完整。

## Risks / Trade-offs

- **[Risk] public SDK 过薄，tool 仍会回头依赖 internal 模块** → Mitigation：让脚手架、文档和 recipe 真实使用 SDK，反向暴露缺口。
- **[Risk] public SDK 过厚，把 framework internal 也固化为长期负担** → Mitigation：只暴露 tool 真正需要的能力，不把内部 registry、controller 细节直接公开。
- **[Risk] 兼容层存在期过长，形成双入口** → Mitigation：明确文档推荐路径，后续 change 再安排兼容层收敛计划。

## Migration Plan

1. 定义 public SDK 入口与职责边界。
2. 为现有 runtime 能力补齐 SDK re-export 和类型收口。
3. 先迁移脚手架与作者文档。
4. 逐步把现有 tool 示例迁移到 SDK 入口。
5. 在后续 change 中评估是否移除不再推荐的 direct internal imports。

## Open Questions

- public SDK 入口是采用单一根入口，还是按 capability 拆成少量子入口更合适。
- 是否需要在 runtime context 中显式暴露 `sdkVersion` 一类的诊断字段。
