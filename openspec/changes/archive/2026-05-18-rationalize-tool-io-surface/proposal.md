## Why

当前仓库已经形成 `runtime/file-input`、`runtime/io` 和 `components/tool-io` 三层 IO 能力，但对 tool 作者来说，哪一层是 public surface、哪一层是底层实现、哪一层是现成 UI 入口还不够清晰。继续让作者在多个入口之间自行判断，会让接入成本和文档成本一起上升。

## What Changes

- 明确 tool-facing IO surface 的分层语义：底层文件读取、tool 直接使用的 source 抽象、以及现成 UI 组件层。
- 收口对外推荐的 IO 入口，减少 tool 作者直接耦合到底层文件读取细节的概率。
- 让文档和脚手架围绕统一的 IO 心智模型组织，而不是分别介绍多个看似并列的入口。
- 保留 escape hatch：需要深度自定义的 tool 仍可直接复用底层 `file-input` 管线。

## Capabilities

### New Capabilities

### Modified Capabilities
- `file-input-pipeline`: 调整共享文件输入管线的对外定位，明确其作为底层能力而不是默认起步入口。
- `tool-io`: 扩展 tool-facing IO 抽象和 UI 入口要求，明确推荐使用路径和分层职责。

## Impact

- `src/lib/runtime/file-input/`
- `src/lib/runtime/io/`
- `src/lib/components/tool-io/`
- `docs/guides/Making Tools/`
- `openspec/specs/file-input-pipeline/spec.md`
- `openspec/specs/tool-io/spec.md`
