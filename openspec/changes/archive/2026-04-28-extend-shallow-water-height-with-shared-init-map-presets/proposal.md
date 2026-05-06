## Why

当前 `shallow-water-height` 只能从本地黑白图像读取 init map，并同时暴露静态图片与视频导出。这限制了快速搭建标准波源、条带波源和可复用输入源的工作流，也让其他 tool 无法直接复用同一套程序化 init map 生成能力。

## What Changes

- 新增一套共享的 preset init map source，提供可参数化的圆形、方形、横条和竖条图形，作为 tool 可直接调用的输入源，而不是散落在单个 tool 内部实现。
- 圆形与方形预设需要同时支持 `fill` 与 `outline` 两种模式；在 `outline` 模式下，outline width 与 feather 都必须可调。
- 预设图形至少支持位置、尺寸和 feather 控制；其中横条/竖条需要支持铺满整个 width 或 height，仅调节其轴向位置、厚度与 feather。
- `shallow-water-height` 从“仅支持本地图像 init map”扩展为“支持共享 preset init map source 的 init map 工作流”，并允许在工具内选择和调节这些预设波源。
- `shallow-water-height` 的输出能力调整为仅保留视频导出，不再暴露静态图片导出。
- **BREAKING**: `shallow-water-height` 的 Export Section 不再提供 PNG 或其他静态图像输出入口。

## Capabilities

### New Capabilities
- `preset-init-map-source`: 定义一套可被任意 tool 直接调用的共享 init map 预设输入源，覆盖圆形、方形、横条、竖条以及 circle/square 的 fill/outline 模式、统一参数模型、采样输出与复用方式。
- `shallow-water-height-tool`: 定义浅水高度工具在共享 preset source 集成后的工具级行为，包括 init map 来源扩展与 video-only 导出约束。

### Modified Capabilities


## Impact

- 新增共享 preset init map 模块及其参数/采样约定，供 `src/tools/` 下多个 tool 直接消费。
- 调整 `src/tools/shallow-water-height/` 的左侧输入面板、init map 构建路径和导出声明。
- `shallow-water-height` 的 metadata/exporter 需要从 image+video 改为 video-only，但不需要修改 framework 级 canvas export runtime。
- 后续 specs 与 design 需要明确共享模块 API、图形参数模型、circle/square 的 fill/outline 语义，以及与 tool 集成方式，避免每个 tool 各自复制图形生成逻辑。