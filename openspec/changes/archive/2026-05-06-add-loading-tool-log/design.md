## Context

当前工具会话由 `ToolSession.svelte` 管理，打开或重试工具时依次执行工具定义加载、声明技术栈加载、入口组件懒加载，期间 Loading UI 只展示静态标题与说明。用户在加载时间较长或失败前无法判断当前阶段，尤其是声明 `three`、`pixi`、`gsap` 的工具首次打开时等待感更明显。

项目约束要求工作区壳层拥有顶层布局，工具只能渲染自身左右面板内容；因此 Loading Tool 日志应留在 framework-owned 的工具会话加载态内，而不是交给各 tool 实现。共享 UI 文案保持英文，文档与 OpenSpec 使用中文。

## Goals / Non-Goals

**Goals:**

- 在 Loading Tool 居中界面展示当前加载尝试的可读日志。
- 让日志覆盖工具定义、声明技术栈、入口组件与即将挂载等关键阶段。
- 切换工具或点击 Retry 时清空旧日志，避免混合不同加载尝试。
- 加载失败时保持现有错误标题、错误信息与 Retry 行为，同时保留最近步骤日志作为上下文。

**Non-Goals:**

- 不改变工具目录 schema、metadata schema、`ToolDefinition` contract 或工具作者 API。
- 不新增全局日志系统、持久化日志、调试控制台或遥测。
- 不要求各工具上报自定义加载步骤。
- 不改变 `loadTechStack` / `loadTechStacks` 的缓存和动态 import 语义。

## Decisions

1. 日志状态由 `ToolSession.svelte` 局部维护。

   该组件已经拥有加载尝试版本号、加载错误和重试逻辑，放在这里可以直接跟随 `toolId` 与 `reloadToken` 生命周期清理。备选方案是新增共享 runtime store，但当前需求只影响加载态展示，抽成全局状态会扩大 API 面。

2. 日志采用固定阶段事件，而不是从底层 loader 回调注入。

   `ToolSession.svelte` 可以在调用 `loadToolDefinition`、`loadTechStacks`、`loadComponent` 前后追加日志。这样不需要改变 registry 或技术栈 loader 的签名，也不会让工具定义加载器承担 UI 语义。备选方案是在 `loadToolDefinition` 和 `loadTechStacks` 中支持 progress callback，但会让底层 runtime API 为单一 UI 场景增加耦合。

3. 日志只展示当前加载尝试的状态，并受 `loadVersion` / `disposed` 防护。

   现有实现已经用版本号避免过期 async 结果写入组件状态；日志更新也应走相同防护，确保快速切换标签、关闭会话或重试时不会显示过期步骤。

4. 错误态复用同一日志列表组件样式。

   加载中展示日志可以强调最新步骤，失败后展示最近步骤和错误信息，用户能看到失败前最后阶段。备选方案是失败时只显示错误文案，但这会丢失本次变更最重要的诊断上下文。

## Risks / Trade-offs

- [Risk] 固定日志阶段可能不覆盖未来更复杂的加载分支。→ 先保持局部数据结构简单，后续若出现真实跨模块进度需求再升级为 runtime progress API。
- [Risk] 加载很快时日志短暂闪烁。→ 保持现有 Loading UI 行为，不人为延迟加载；快速完成时直接挂载工具。
- [Risk] 日志文案过多会让居中加载态显得拥挤。→ 限制为少量关键阶段，使用紧凑列表和稳定宽度。