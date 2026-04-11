# Marble Design Toolset

Marble Design Toolset 是一个基于 SvelteKit 的 Pixel Tool Framework，用来承载多个横屏设计工具。当前框架已经提供统一的 workspace shell、tool runtime、共享 UI 包装层以及按需 tech stack 加载机制。

## 文档入口

- 架构设计：`docs/pixel-tool-framework-architecture.md`
- Tool 开发指南：`docs/tool-authoring-guide.md`
- OpenSpec 变更：`openspec/changes/establish-pixel-tool-framework/`

## 开发命令

```bash
npm run dev
npm run build
npm run preview
```

## 当前框架约束

- 不使用 Tailwind，统一使用 CSS Custom Properties 和 px 单位
- 共享 UI 文案使用英文
- 应用按纯横屏设计，视口宽度小于 720px 时阻止正常工作区渲染
- tool 必须遵循 `src/tools/<tool-id>/metadata.json + index.ts + 单一 master .svelte + components/` 的目录 schema
- heavy tech stack 通过共享 runtime 声明并加载，目前支持 `three`、`pixi`、`gsap`

如果要新增 tool，请直接从 `docs/tool-authoring-guide.md` 开始。
