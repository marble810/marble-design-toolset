## Why

当前 framework 已经分别提供工具会话活动状态、render host lifecycle、canvas export 注册与 loading/error UI，但 tool 作者仍然需要自己决定这些能力如何拼装。随着 Pixi/Three、export 和长生命周期工具增多，这种“能力都在，但组合方式靠作者自行摸索”的状态会持续制造重复 wiring 和遗漏清理点。

## What Changes

- 统一定义 tool 与 host 的生命周期拼装模型，覆盖 init、ready/error、active/inactive、cleanup 和 exporter registration。
- 让 PreviewCanvas、FullStage 和 render host 工具都能使用同一套宿主生命周期语义，而不是各自摸索接入顺序。
- 明确 framework 提供的生命周期 helper 和 tool 仍然自行拥有的内部渲染逻辑边界。
- 保持 tool 自由选择渲染实现，不把具体渲染策略固化到宿主契约中。

## Capabilities

### New Capabilities
- `tool-host-lifecycle`: 定义 tool 接入宿主生命周期时可依赖的统一语义和组合边界。

### Modified Capabilities
- `render-host-lifecycle`: 扩展 render host 生命周期要求，使其和统一 host lifecycle 语义对齐。
- `tool-session-lifecycle`: 扩展工具会话活动/隐藏生命周期要求，使其成为统一 host lifecycle 的组成部分。
- `tool-canvas-export`: 调整 exporter 注册与释放时机要求，使其与统一 host lifecycle 对齐。

## Impact

- `src/lib/components/shell/tool-session/`
- `src/lib/runtime/render-host/`
- `src/lib/runtime/tool-session-context.ts`
- `src/lib/runtime/canvas-export/`
- `docs/guides/Making Tools/`
- `openspec/specs/render-host-lifecycle/spec.md`
- `openspec/specs/tool-session-lifecycle/spec.md`
- `openspec/specs/tool-canvas-export/spec.md`
