## Context

当前 framework 已经有 `ToolSession`、`tool-session-context`、`render-host/lifecycle`、`canvas-export context` 等能力，但它们更多是分层存在，而不是一套明确的 host lifecycle 模型。对于简单 tool，这不是问题；对于持续渲染、需要 active/inactive 感知、还要注册 exporter 的 tool，作者必须自行判断初始化顺序、清理时机和错误状态传播方式。

这类复杂性属于宿主与插件的集成复杂性，而不是 tool 自身的业务复杂性。本次设计目标是把这种集成复杂性下沉到统一的宿主生命周期语义中。

## Goals / Non-Goals

**Goals:**
- 统一 tool 接入 host lifecycle 时的核心语义：init、ready/error、active/inactive、cleanup、export registration。
- 让 PreviewCanvas、FullStage 和 render host 类 tool 都能消费同一套宿主生命周期模型。
- 保持 tool 继续拥有自己的 scene、shader、simulation 和绘制逻辑。
- 降低遗漏 cleanup、遗漏 unregister 或错误状态分散管理的概率。

**Non-Goals:**
- 不把 Pixi、Three、Canvas2D 强行统一成单一渲染抽象。
- 不把 PreviewCanvas 或 FullStage 变成唯一允许的呈现方式。
- 不接管 tool 内部的领域状态管理。
- 不要求所有现有 tool 立即迁移到新 helper。

## Decisions

### 决策 1：把 host lifecycle 定义为独立于具体渲染技术的组合层

host lifecycle 不直接等同于 render host helper，而是更上层的组合语义，至少覆盖：
- init / ready / error
- active / inactive
- cleanup
- exporter register / unregister

render host、session active、canvas export 都作为这套组合语义的组成部分存在。这样可以同时服务连续渲染 tool 和非连续渲染 tool。

### 决策 2：保留 tool 对渲染逻辑的完全所有权

framework 只负责宿主相关状态和生命周期编排，不接管 tool 的 scene graph、shader、simulation step、draw call 或参数模型。这样不会把开放插件结构重新拉回到 framework 强控内部实现。

### 决策 3：统一 exporter 生命周期到 host lifecycle

导出注册和释放应该跟随同一套 host lifecycle 语义，而不是由每个 tool 自己在不同层级重复决定。任何 helper 协助注册的 exporter，都必须在对应生命周期结束时自动注销。

### 决策 4：新模型必须对现有工具保持渐进兼容

本次不采用“一次性把所有 tool 全迁移”的策略，而是让新 helper 与现有接入方式共存一段时间。脚手架和后续 recipe 先消费新模型，再逐步让现有复杂 tool 迁移。

## Risks / Trade-offs

- **[Risk] 新 lifecycle helper 过强，变相限制 tool 实现** → Mitigation：helper 只管理宿主状态，不接管领域渲染代码。
- **[Risk] lifecycle 语义与 render host/helper 边界不清，形成重复 abstraction** → Mitigation：明确 host lifecycle 是组合层，render host 是具体渲染宿主层。
- **[Risk] 渐进兼容期过长，维护双模型** → Mitigation：让新脚手架和 recipe 默认使用新模型，形成自然迁移压力。

## Migration Plan

1. 定义 host lifecycle 的公共 contract 和状态语义。
2. 对齐 `tool-session-context`、`render-host` 和 `canvas-export` 的接入方式。
3. 先在脚手架或示例 tool 中使用新的统一 helper。
4. 逐步迁移现有复杂 tool，并保留旧模式的兼容窗口。
5. 在后续 change 中评估是否进一步收敛旧 helper API。

## Open Questions

- host lifecycle 是否需要直接暴露给所有 tool，还是优先通过 render host / source / export recipe 间接消费。
- 非连续渲染但需要 export 的简单 tool，是否也应使用同一套 ready/error helper。
