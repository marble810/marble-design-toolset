## Context

当前 workspace 会对所有工具的 metadata.json 做 eager discovery，并直接基于 discovery 结果生成 catalog、合法工具 ID 集合以及初始恢复所需的 validToolIds。工具是否出现在 Open Tool 列表、是否允许通过 hash 激活、是否能从本地持久化恢复，本质上都由同一份 catalog 结果驱动。

这意味着，如果要把 enabled 做成硬开关，最稳妥的位置不是在工具打开之后再拦截，而是在 metadata discovery 阶段就把 disabled tool 从 catalog 和合法工具集合中排除。与此同时，当前仓库已经明确保留 index.ts 作为 tool runtime definition 的合约，因此本次设计必须避免把 enabled 的职责扩散到 index.ts 或引入新的 tool 入口文件模式。

## Goals / Non-Goals

**Goals:**
- 为每个工具提供一个 metadata 级别的 enabled 布尔开关，统一控制其是否可被 workspace 使用。
- 让 disabled tool 同时从工具架、合法工具 ID、hash 激活和本地恢复链路中消失，形成一致的硬开关语义。
- 保持现有 index.ts、懒加载组件和 tech stack 声明机制不变，把改动集中在 metadata 类型、registry 和状态恢复链路。
- 让现有工具可以低风险迁移，不要求先重构 tool contract。

**Non-Goals:**
- 不移除、弱化或重构每个工具的 index.ts 运行时定义文件。
- 不引入“仅隐藏但仍可 deep-link”的软可见性语义；本次只提供硬禁用。
- 不在 metadata 中新增 techStack、loadComponent 或其他运行时装配字段。
- 不处理工具分组、灰度百分比、权限控制等更复杂的上架策略。

## Decisions

### 决策一：字段命名采用 enabled，而不是 enable 或 visibility

使用 enabled 可以明确表达“当前工具是否处于启用状态”的布尔语义，并与元数据中的静态声明方式一致。相比之下，enable 更像动作指令，visibility 则更偏向展示层，无法准确表达“不可打开、不可恢复”的硬禁用行为。

备选方案：
- `enable`: 命名不自然，容易被误解为操作而非状态。
- `listed` 或 `visible`: 只能表达是否展示，无法覆盖 hash 与恢复链路的失效语义。

### 决策二：在 metadata discovery 阶段执行过滤，而不是在 loadToolDefinition 阶段兜底

enabled 的目标是让工具从整个 workspace 可用集合中消失，因此需要在 tool-registry 构建 catalog 和 valid tool ID 集合时就生效。这样 Open Tool 列表、isValidToolId、初始 hash 解析和本地状态清洗都可以复用同一份过滤结果，避免 UI 与运行时出现分裂。

备选方案：
- 在 loadToolDefinition 阶段拒绝 disabled tool：过晚，工具仍会出现在目录里，也仍可能被 hash 或持久化状态选中。
- 只在 UI 层过滤工具架：会留下 deep-link 与恢复入口，不能满足硬开关要求。

### 决策三：缺省 enabled 按 true 处理，并在同一变更中补齐现有 metadata

为了降低迁移风险，运行时应把缺失 enabled 的旧 metadata 视为 true。这样即使仓库中存在尚未补字段的工具，也不会在切换期间被意外下线。同时，这次实现仍应把现有工具 metadata 全量补上 enabled，避免文档与代码长期处于“双语义”状态。

备选方案：
- 强制所有 metadata 立即具备 enabled，缺失即报错：约束更硬，但会把一次简单功能改动放大成全仓库同步修复问题。

### 决策四：把 enabled 继续视为静态 metadata，而不是新的 runtime definition 字段

enabled 影响的是工具是否进入 catalog 和合法 ID 集合，属于 metadata discovery 阶段就应可判定的静态信息。将其留在 metadata.json，可以保持“无需加载运行时代码即可决定工具是否可用”的特性，也符合当前工具架的发现方式。

备选方案：
- 放入 index.ts：会让工具是否可用依赖运行时代码加载，违背当前 eager metadata discovery 的分层目标。

## Risks / Trade-offs

- [缺省 true 会延长过渡期] → 通过在本次实现中同步补齐现有 metadata，并在开发指南里把 enabled 记录为标准字段，减少长期模糊状态。
- [硬开关语义过强，后续若需要“隐藏但可访问”仍要再设计] → 明确把这次变更限定为 enabled 硬开关，未来若出现软可见性需求，再新增独立字段而不是复用 enabled。
- [disabled tool 会从持久化状态中被清洗，用户可能感知为标签页消失] → 在设计上接受这一行为，因为它正是“工具已下线”的一致体现；不为 disabled tool 保留半可用状态。

## Migration Plan

1. 在类型与 metadata 读取链路中加入 enabled 支持，并采用缺省 true 的兼容规则。
2. 更新现有工具的 metadata.json，显式补上 enabled 字段。
3. 在 tool-registry 与 workspace 状态恢复链路中统一使用过滤后的合法工具集合。
4. 更新 tool 开发指南和对应 OpenSpec 规格，明确 enabled 的语义与默认行为。

## Open Questions

- 当前没有未决的技术问题；若后续出现“隐藏但仍允许 deep-link”的需求，应另起变更讨论新的 visibility 语义，而不是扩展 enabled。