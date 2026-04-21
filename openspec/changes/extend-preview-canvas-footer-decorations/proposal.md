## Why

当前 PreviewCanvas 提供的是统一导航壳层，但缺少一个框架级、受约束的“外置信息块”能力，导致工具作者只能各自手写定位与样式，难以保持一致。现在补齐这项能力，可以在不破坏共享预览交互的前提下，让工具稳定展示标识、状态字符或轻量提示，并为后续可扩展配置留出空间。

## What Changes

- 为 PreviewCanvas 增加可选的右下角外置信息块渲染能力，挂载点由框架统一提供，位于画布区域之外。
- 外置信息块锚定在 Canvas 框的右侧下方，并随画布平移与缩放后的框体位置变化同步移动。
- 信息块采用固定宽度 20em；单行溢出使用省略号展示，并在 hover 时显示全文 tooltip。
- 信息块内容限制为最多 5 行：首行支持 IconOnly / IconAndTitle / TitleOnly 三种模式，后续行仅允许文本内容。
- 限定可用元素为 div、p、PixelIcon，避免任意节点破坏预览交互与布局稳定性。
- 提供 helper 驱动的开发者输入方式，减少工具侧样板代码并统一内容结构。
- 对超限内容执行静默裁剪，保证运行时稳定，不额外弹出告警或报错。
- 补充文档与示例，说明何时使用该能力、如何组合 icon 与文本、以及如何遵守限制。

## Capabilities

### New Capabilities

### Modified Capabilities
- `right-panel-modes`: PreviewCanvas 扩展框架级右下角外置信息块能力，并定义元素与行宽约束。
- `tool-shell-workspace`: 共享预览舞台能力补充装饰区渲染契约，确保不影响既有缩放与平移交互。

## Impact

- Affected component: src/lib/components/shell/preview-canvas/PreviewCanvas.svelte
- Potentially affected types/exports: src/lib/components/shell/preview-canvas/index.ts 与相关 helper/类型定义
- Affected specs: openspec/specs/right-panel-modes/spec.md, openspec/specs/tool-shell-workspace/spec.md
- Affected docs: docs/tool-authoring-guide.md（需要新增装饰区使用说明）
- Existing tools remain backward compatible when not using the new decoration capability