## Why

当前共享 tech-stack loader 将 `three`、`pixi`、`gsap` 统一暴露为 `unknown`，导致工具侧必须重复书写类型断言；一旦局部实例或中间变量退化为 `any`，编辑器自动补全、参数提示和静态检查就会立即失效。随着基于 PixiJS 的新工具开始落地，这个问题已经从单点书写成本演变为框架层开发体验缺陷，需要在运行时 API 层统一修正。

## What Changes

- 为共享 tech-stack registry 建立 key 到模块类型的静态映射，让单个技术栈加载结果在工具侧自动推导为对应模块类型，而不是 `unknown`。
- 调整批量技术栈加载 API 的返回类型，使其在声明 `techStack` 时保留各 key 对应的模块类型信息，减少调用方二次断言。
- 明确工具侧的推荐类型使用模式，避免示例和脚手架继续以 `any` 持有 Pixi 或 Three 运行时对象，恢复原生库开发时的自动补全体验。
- 将这类能力定义为共享运行时 contract，而不是让每个工具单独封装自定义 loader 或重复写局部类型补丁。

## Capabilities

### New Capabilities

### Modified Capabilities
- `tool-module-runtime`: 共享 tech-stack registry 的加载 API 需要对 `three`、`pixi`、`gsap` 提供与 key 对应的静态类型推导，并为工具侧声明/消费这些模块提供一致的开发体验约束。

## Impact

- Affected runtime: `src/lib/runtime/tech-stack.ts`
- Affected types: `src/lib/types/tool.ts`
- Affected tool consumers and examples: `src/tools/**`, `docs/guides/tool-pixi-guide.md`, 以及后续脚手架模板
- No new runtime dependencies and no expected breaking runtime behavior; the main change is stronger TypeScript contracts and updated authoring guidance