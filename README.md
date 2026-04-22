# Marble Design Toolset

Marble Design Toolset 是一个基于 SvelteKit 的多工具设计工作区，用来承载多个横屏设计工具。当前工作区已经提供统一的 workspace shell、tool runtime、共享 UI 包装层以及按需 tech stack 加载机制。

## 文档入口

- 架构设计：`docs/architecture/project-architecture-analysis.md`
- Tool 开发指南：`docs/guides/Making Tools/tool-authoring-guide.md`
- OpenSpec 变更：`openspec/changes/`

## 开发命令

```bash
bun run create:tool
npm run dev
npm run build
npm run preview
```

## 创建新 Tool

推荐先使用项目内脚手架命令：

```bash
bun run create:tool
```

该命令会交互式询问：

- tool name
- starter type: `preview` 或 `stage`
- tech stacks: `three`、`pixi`、`gsap`

脚手架会自动生成符合当前 runtime contract 的 `src/tools/<tool-id>/` 目录，包含 `metadata.json`、`index.ts`、唯一的 root-level master `.svelte`，以及位于 `components/` 下的私有子组件。生成后执行 `npm run build` 做一次校验。

## 当前框架约束

- 不使用 Tailwind，统一使用 CSS Custom Properties 和 px 单位
- 共享 UI 文案使用英文
- 应用按纯横屏设计，视口宽度小于 720px 时阻止正常工作区渲染
- tool 必须遵循 `src/tools/<tool-id>/metadata.json + index.ts + 单一 master .svelte + components/` 的目录 schema
- heavy tech stack 通过共享 runtime 声明并加载，目前支持 `three`、`pixi`、`gsap`

如果要新增 tool，先运行 `bun run create:tool`，再结合 `docs/guides/Making Tools/tool-authoring-guide.md` 完成后续开发。
