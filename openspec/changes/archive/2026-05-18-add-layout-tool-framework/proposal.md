## Why

当前工具体系已经支持 PreviewCanvas、文件输入、导出 runtime 与 tool 脚手架，但平面版式设计模板仍需要在每个 tool 中重复实现画布尺寸状态、多个素材输入、字体加载和 DOM 导出 glue code。为了支持“template as a tool”的长期方向，需要在现有技术栈上形成一个框架原生的 layout-tool 子框架，让每个版式模板仍保持 Svelte + CSS 的最大自由度，同时复用统一 IO、导出和脚手架能力。

## What Changes

- 新增面向 tool 作者的 headless layout-tool SDK：通过 `$lib/tool-sdk/index.js` 暴露 `createLayoutToolController`，集中管理动态画布尺寸、命名 source slots、字体来源和 DOM 导出注册。
- 扩展 file-input / tool IO，使其支持多个命名输入 slot，并新增 `font` kind；单输入场景必须保持现有 SourceInputSection 和 DropZone 行为兼容。
- 升级 canvas export 的 `dom` exporter，使其基于 `html-to-image` 完成 DOM 节点到 PNG 的框架原生导出，并保留现有 Export panel 的 1x / 2x / 4x、文件名和结果状态体验。
- 增加 Google Fonts 与用户上传字体的统一前端字体管线；Google Fonts 加载失败时允许回退系统字体，并在导出面板显示 warning。
- 扩展 tool 脚手架，新增 `layout-template` recipe，生成一个完整示例：动态尺寸、多 source slots、Google Font、上传字体和 DOM 导出均已接好。
- 在 `docs/` 下补充 layout-tool 开发文档，面向 tool 开发者说明如何使用 `createLayoutToolController` 编写平面版式模板工具。

## Capabilities

### New Capabilities

- `layout-tool-framework`: 定义 headless layout-tool SDK 的行为，包括动态画布尺寸 controller、字体 controller、source slots 集成、DOM exporter 注册和开发者入口。

### Modified Capabilities

- `file-input-pipeline`: 支持 `font` kind 与多个命名输入 slot 的底层 ingest、错误、状态和清理语义。
- `tool-io`: 扩展 tool-facing source workflow，使 SourceInputSection / DropZone 能自动兼容单 slot 与多 slot，并暴露 slot name / desc / required / maxSizeMB 等声明。
- `tool-canvas-export`: 升级 `kind: 'dom'` PNG 导出为基于 `html-to-image` 的实现，并支持 layout DOM 导出的安全选项和 warning 透出。
- `tool-scaffolding`: 新增 `layout-template` recipe，生成符合 tool module schema 的完整 layout-template starter。

## Impact

- 影响 `src/lib/tool-sdk/` 的公共导出面，新增 layout-tool headless controller API。
- 影响 `src/lib/runtime/file-input/`、`src/lib/components/tool-io/` 与相关类型，增加多 slot 和字体输入能力。
- 影响 `src/lib/runtime/canvas-export/` 与 `src/lib/types/canvas-export.ts`，引入 `html-to-image` 依赖并强化 DOM exporter。
- 影响 `scripts/` 下 tool 脚手架 recipe 与生成模板。
- 影响 `docs/for-tool-developers/`，新增或更新 layout-template 开发指南。
