## Why

当前 tool 侧已经可以复用 runtime、source input、export 和 render host，但这些能力主要以框架内部模块的形式暴露，tool 作者很容易直接依赖深层实现路径。随着 runtime 继续演进，如果缺少稳定的 tool-facing SDK 边界，框架重构会不断把现有 tool 一起打碎。

## What Changes

- 新增一层稳定的 tool-facing SDK surface，统一承载 ToolDefinition、runtime context、source input、export、render host 等宿主能力入口。
- 明确区分 framework-internal 模块与 public tool API，约束脚手架、文档和后续实现优先依赖 public surface。
- 为 tool-facing SDK 引入兼容性语义，允许框架在不强迫 tool 跟随内部重构的前提下逐步演进。
- 保持现有 tool 目录 schema 和宿主壳层边界不变，不把 tool 的内部实现方式纳入 framework 约束。

## Capabilities

### New Capabilities
- `tool-sdk-surface`: 定义框架对 tool 暴露的稳定 SDK 边界、公共入口和兼容性语义。

### Modified Capabilities
- `tool-module-runtime`: 扩展 tool runtime 合约，使其要求 framework 为 tool 提供稳定的 SDK 入口，而不是让 tool 直接依赖深层内部模块。

## Impact

- `src/lib/runtime/`
- `src/lib/types/`
- `scripts/tool-scaffold/`
- `docs/guides/Making Tools/`
- `openspec/specs/tool-module-runtime/spec.md`
