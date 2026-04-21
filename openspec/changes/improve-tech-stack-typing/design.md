## Context

当前 `loadTechStack` 与 `loadTechStacks` 把所有可选技术栈统一暴露为 `unknown`，而现有示例工具与指南进一步把模块实例或渲染对象声明为 `any`。这让共享 registry 虽然保住了按需加载和缓存复用，却把最常用的编辑器能力一并丢掉了：模块成员自动补全、构造参数提示、实例方法静态检查都依赖调用点自己补类型。

这次变更的约束很明确：`three`、`pixi`、`gsap` 仍然必须保持共享 registry、按需加载和缓存复用；工具目录 schema、运行时装载顺序和依赖声明方式不应因类型优化而发生额外迁移。需要修复的是框架 contract，而不是让每个工具继续写自己的局部断言或包装器。

## Goals / Non-Goals

**Goals:**

- 为 `three`、`pixi`、`gsap` 建立统一的 key 到模块类型映射，避免 `TechStackKey` 与实际 loader 表分离演化。
- 让 `loadTechStack` 在单 key 调用场景下直接返回对应模块类型，让工具侧恢复原生库自动补全体验。
- 让 `loadTechStacks` 在调用方保留字面量 key 集合时返回与 key 集合同步的类型结果，同时保留宽数组场景下的安全回退类型。
- 提供工具作者可复用的 helper type 或 authoring pattern，替换现有文档和示例中的 `any`。
- 保持现有懒加载、缓存复用和工作区门控行为不变。

**Non-Goals:**

- 不新增新的可选技术栈，也不改变 `three`、`pixi`、`gsap` 之外的支持范围。
- 不为每个第三方库对象引入额外的运行时包装层或服务定位器。
- 不为了追求类型完美而重写整个工具加载流程。
- 不要求一次性清理仓库中所有历史 `any`，只覆盖共享 runtime、示例工具和作者指南中最关键的路径。

## Decisions

### Decision 1: 用独立的共享类型映射作为 tech-stack contract 单一事实源
新增一个专用的 tech-stack 类型定义模块，集中声明 `TechStackModuleMap` 与从其派生的 `TechStackKey`。`tool.ts`、runtime loader 以及工具作者可复用的 helper type 都从这里读取，而不是继续让 key union 和 loader record 分散在不同文件里维护。

这样做的原因：

- key 与模块类型绑定关系只维护一次，避免未来新增或删减技术栈时出现类型漂移。
- public API 和 authoring helper 可以直接复用同一份映射，不需要在多个位置重复写 `typeof import(...)`。

考虑过的替代方案：

- 保持 `TechStackKey` 在 `tool.ts`，只在 `tech-stack.ts` 内部用泛型强转：实现快，但仍然保留两个事实源。
- 让每个工具自行定义 `type PixiModule = typeof import('pixi.js')`：对单工具可行，但无法解决共享 contract 缺失的问题。

### Decision 2: 公开 API 使用泛型推导，内部缓存继续保持最小改动
`loadTechStack` 将改为按 key 返回 `Promise<TechStackModuleMap[K]>`。`loadTechStacks` 将使用面向字面量 tuple 的泛型签名，在调用方保留 `as const` 或窄化 key 集合时返回与这些 key 对齐的对象类型；当输入被宽化为普通 `TechStackKey[]` 时，返回安全的通用映射类型。

内部实现仍然保留当前的共享 cache 思路，只把边界处的类型断言集中在 runtime 内部，而不是把不确定性泄漏到每个工具调用点。

这样做的原因：

- 风险最小，不改变现有懒加载和复用语义。
- 类型复杂度集中在一个共享边界，避免工具作者重复发明局部封装。

考虑过的替代方案：

- 为每个技术栈提供单独 loader 函数，例如 `loadPixi()`、`loadThree()`：调用体验直观，但会让 registry contract 分裂成多套 API。
- 把 cache 也建模成完全按 key 精确的对象结构：类型更纯粹，但实现收益不足，且会引入额外样板。

### Decision 3: 作者体验通过 helper type 和示例更新一起落地
仅仅让 `loadTechStack('pixi')` 变成强类型还不够；工具作者仍然需要一个明确模式来声明本地模块引用、应用实例或渲染器变量。这次变更会同时提供可复用的 helper type（例如按 key 取模块类型的 alias），并更新 Pixi/Three 的示例代码与指南，改用 type-only import 或共享 helper，而不是继续把长期存活对象声明为 `any`。

这样做的原因：

- 示例代码会塑造整个仓库的后续写法，若不修正文档，`any` 会继续扩散。
- type-only import 不会改变懒加载语义，可以在不增加运行时代码的前提下恢复实例级别的补全。

考虑过的替代方案：

- 只改 runtime 类型，不改示例和指南：实现最少，但无法实际改善作者体验。
- 强制所有工具都只能使用共享 helper type，禁止 type-only import：约束过重，没有必要。

## Risks / Trade-offs

- [泛型签名过于复杂，影响 Svelte/TypeScript 推导稳定性] → Mitigation: 仅使用一层显式 module map 和有限的 helper alias，避免引入深层条件类型。
- [批量加载在调用方传入普通数组时仍无法做到完全精确推导] → Mitigation: 明确这是安全回退行为，并在文档中说明需要字面量 key 集合时使用窄化数组。
- [现有示例工具改成强类型后可能暴露新的真实类型问题] → Mitigation: 先覆盖代表性 Pixi/Three 消费者，并通过构建验证修复暴露出的局部不一致。
- [作者误把 type-only import 写成普通 import，破坏按需加载语义] → Mitigation: 在指南中明确使用 `import type`，并保持运行时加载始终通过共享 loader 完成。

## Migration Plan

1. 引入共享 tech-stack 类型映射，并让 `TechStackKey` 从该映射派生。
2. 重新声明 `loadTechStack` 与 `loadTechStacks` 的公开类型签名，保持内部缓存行为不变。
3. 更新代表性工具消费点与作者指南，替换 `any` 为 helper type 或 type-only import 模式。
4. 运行仓库现有构建与测试，确认动态加载行为未回归，且类型优化不会破坏现有工具装载流程。

## Open Questions

- 当前无阻塞性开放问题。若后续发现更多工具需要对特定第三方实例类型做统一别名，可在实现阶段按最小必要原则补充，但不在本次设计中预先扩张范围。