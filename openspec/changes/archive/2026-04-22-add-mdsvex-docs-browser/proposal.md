## Why

当前仓库已经积累了架构、分析和工具编写文档，但这些内容只能作为源码目录中的 Markdown 文件被开发者手动查找，缺少一个可直接从工作区进入、可按目录浏览、可在浏览器中阅读的统一文档入口。现在补齐这条链路，可以把文档真正纳入产品工作流，让开发者从右上角直接打开 Docs 页面，并以更低成本维护和消费这些文档内容。

## What Changes

- 为工作区右上角 Header 增加 Docs 按钮，并以新标签页方式打开独立文档页面。
- 引入基于 mdsvex 的文档渲染方案，使 docs 目录下的 Markdown 文档可以作为站内页面被浏览。
- 新增文档浏览页，根据 docs 文件夹层级生成左侧目录或导航树，并支持进入具体文档阅读内容。
- 约束文档入口仅面向现有 docs 目录中的开发者文档，不改变当前工具工作区的主交互模型。
- 补充文档站点的加载、导航和空状态规范，确保在没有匹配文档或目录为空时仍有稳定的可读反馈。

## Capabilities

### New Capabilities
- `workspace-docs-browser`: 提供一个基于 mdsvex 的站内文档浏览能力，支持按 docs 目录结构生成导航并渲染 Markdown 内容。

### Modified Capabilities
- `tool-shell-workspace`: 工作区 Header 顶层操作入口从 Open、Help、Settings 扩展为 Open、Help、Docs、Settings，并要求 Docs 入口以新标签页打开独立文档页面。

## Impact

- Affected routes: src/routes/+page.svelte，以及新增 Docs 浏览相关路由
- Affected config/build: svelte.config.js，package.json，新增 mdsvex 相关依赖与集成配置
- Affected content source: docs/ 下现有 Markdown 文档及其目录结构将成为运行时导航数据来源
- Affected specs: openspec/specs/tool-shell-workspace/spec.md，以及新增 openspec/changes/add-mdsvex-docs-browser/specs/workspace-docs-browser/spec.md
- Affected UX: 工作区 Header、新标签页跳转行为、文档浏览页目录与阅读体验