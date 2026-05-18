## Context

当前脚手架已经能生成 preview / stage 两类 starter，并支持 tech stack 声明，但真实工具的起步需求已经不止于此。仓库内正在重复出现 source input、drop zone、render host、export wiring 等组合；这些模式如果继续完全靠作者手工拼接，会让新工具的启动成本持续上升。

同时，项目目标是开放插件式结构，而不是把 tool 固化成单一模板。因此 recipe 设计的重点不是“限制工具长什么样”，而是提供一组可跳出的 golden path，让常见场景更快落地。

## Goals / Non-Goals

**Goals:**
- 用 capability recipes 缩短常见 tool 的起步路径。
- 让脚手架生成的代码复用现有 shared runtime 和 shared UI，而不是复制胶水代码。
- 保持现有 tool schema 不变，recipe 只影响起步形态，不改变最终自由度。
- 为后续 docs 和 SDK 入口提供更直观的作者工作流。

**Non-Goals:**
- 不把所有 tool 统一改写为 schema-driven 自动生成 UI。
- 不把 recipe 变成强制规范；作者仍可绕开 recipe 手工搭建。
- 不在本次中引入新的 heavy dependency。
- 不要求一次性实现所有可能的 starter 变体。

## Decisions

### 决策 1：recipe 作为 starter 之上的能力层，而不是替代 tool schema

保留现有 `src/tools/<tool-id>/` schema、`metadata.json`、`index.ts`、单一 root-level master 组件等基础 contract。recipe 只决定脚手架生成的起步 wiring，不改变 tool 最终必须遵守的 schema。

这样可以把 recipe 定位为“高层作者体验”，而不是新一层底层 contract。

### 决策 2：优先覆盖仓库里已经反复出现的五类 recipe

首批 recipe 以真实重复模式为准：
- `preview-basic`
- `source-preview`
- `pixi-preview`
- `three-stage`
- `preview-export`

不追求一次性覆盖所有场景。只有当某类组合已经在多个 tool 中出现并且 wiring 相似时，才上升为 recipe。

### 决策 3：recipe 输出必须优先复用 shared capability

recipe 生成代码时优先使用：
- public tool SDK
- shared tool IO
- render host lifecycle helper
- framework-owned export runtime

而不是在模板里内联第二套下载、picker、drop 或 render cleanup 逻辑。这样 recipe 的存在本身也能检验 shared capability 是否足够好用。

### 决策 4：recipe 选择界面直接面向作者任务，而不是面向框架内部概念

相比只让作者选择 preview / stage / tech stack，recipe 更应该围绕作者想解决的问题组织：\n“只做预览”“需要本地文件来源”“需要 Pixi/Three”“需要导出”。\n内部仍可映射到现有 starter type、tech stack 和 capability wiring，但作者不需要先理解所有内部模块再做选择。

## Risks / Trade-offs

- **[Risk] recipe 数量过多，脚手架交互变重** → Mitigation：只保留少量高频 recipe，避免把脚手架做成配置面板。
- **[Risk] recipe 输出过厚，生成大量作者最终会删除的代码** → Mitigation：每个 recipe 只生成最小可运行 wiring，不生成过度业务示例。
- **[Risk] recipe 与文档脱节** → Mitigation：每个 recipe 都有对应作者文档入口和推荐使用边界。

## Migration Plan

1. 定义 recipe 列表、适用场景和输出 contract。
2. 扩展脚手架输入流程，让作者能按 recipe 选择起步形态。
3. 为每个 recipe 补齐模板与测试。
4. 更新作者文档和 README，围绕 recipe 重写最短上手路径。
5. 视需要让现有示例 tool 对齐新的 recipe 产出形态。

## Open Questions

- recipe 选择是单选更合适，还是允许少量 capability 组合式选择。
- `preview-export` 是否应在首批中直接生成 exporter 注册示例，还是先只生成 metadata/export 声明。
