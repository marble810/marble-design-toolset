# 工具开发者指南

## 适用对象

本节文档面向在 Marble Design Toolset（mdt.）中开发新 tool 或维护现有 tool 的作者。你不需要了解 framework 内部实现，只需要通过公共 SDK 和 recipes 完成工作。

## 最短路径

```bash
bun run create:tool   # 交互式选择名称和 capability recipe
npm run build         # 构建校验
npm run test          # 运行测试
```

## 文档索引

| 文档 | 内容 |
|---|---|
| [create-a-tool.md](./create-a-tool.md) | 从零创建 tool：目录 schema、metadata.json、index.ts、layout 组件和公共 SDK 用法 |
| [file-input.md](./file-input.md) | 使用 framework IO facade 导入本地图像、影片和文字文件 |
| [layout-template.md](./layout-template.md) | 使用 `createLayoutToolController` 构建 DOM 平面版式模板工具 |
| [export.md](./export.md) | 声明导出能力、注册 exporter、PNG / 视频导出流程 |
| [pixi.md](./pixi.md) | 使用 PixiJS 2D 渲染：recipe、render host lifecycle、导出接入 |
| [three.md](./three.md) | 使用 Three.js：recipe、render host lifecycle、animation loop、导出接入 |
| [css-styling.md](./css-styling.md) | 设计 Token、Bits UI 集成、tool 作用域样式 |
| [ui-controls/slider-field.md](./ui-controls/slider-field.md) | SliderField 共享组件用法与约束模型 |

## 核心约束

- Tool 只能从 `$lib/tool-sdk/index.js`、`$lib/components/shell/index.js` 和 `$lib/components/ui/index.js` 导入 framework 能力，不直接依赖 `$lib/runtime/` 内部路径。
- 目录结构必须是：`src/tools/<tool-id>/metadata.json`、`index.ts`、唯一的 root-level master `.svelte`，其余组件放在 `components/`。
- Heavy tech stack（`three`、`pixi`、`gsap`）在 `index.ts` 的 `techStack` 中声明，通过 framework 统一加载；不直接在顶层导入。
- 文件输入优先使用 `createToolSourceInput`，不要重复实现 picker、drop、读取和对象 URL 清理。
- 导出能力由 framework 的 export runtime 统一管理，tool 只声明 metadata 和注册 exporter；不实现下载按钮。

## 如何获取帮助

如果某个能力或 API 在公共 SDK 中找不到，请先查阅 [framework developer 文档](../for-framework-developers/overview.md) 了解边界决策，再联系 framework maintainer 评估是否需要扩展 public surface，而不是直接依赖 `$lib/runtime/` 内部路径。
