# Docs 系统

## 架构概览

文档系统由三层组成：

```
docs/**/*.md                 ← 源文件（Markdown，在仓库中）
    ↓ glob import（vite）
src/lib/docs/metadata.ts     ← catalog 构建（eager import，读取所有 .md）
src/lib/docs/runtime.ts      ← 文档模块加载（mdsvex 渲染组件）
src/lib/docs/catalog.ts      ← 纯逻辑：路径 → slug → tree（testable）
    ↓
src/routes/docs/             ← SvelteKit 路由（layout + page + slug 动态路由）
```

## Catalog 构建逻辑

`src/lib/docs/catalog.ts` 的 `buildDocsCatalog()` 接收文件路径列表和可选的原始 Markdown 内容（用于提取标题），构建：

- `entries`：所有文档的扁平列表（id、slug、href、title、groupSegments 等）
- `tree`：按目录层级组织的树形结构（`DocsTreeRoot`）

Slug 由文件的 docs 相对路径衍生：
```
docs/for-tool-developers/create-a-tool.md
  → slug: for-tool-developers/create-a-tool
  → href: /docs/for-tool-developers/create-a-tool
```

文档标题从 Markdown 第一个 `#` 标题提取，缺失时用文件名推导（`humanizeSegment`）。

树形结构的组标签也由目录名推导：
```
for-framework-developers → "For Framework Developers"
for-tool-developers      → "For Tool Developers"
ui-controls              → "Ui Controls"
```

排序：中文本地化字母序（`localeCompare('zh-CN', { numeric: true })`）。

## 添加新文档

直接在 `docs/` 下合适的 audience 目录创建 Markdown 文件即可。下次构建时 vite 的 `import.meta.glob` 会自动包含新文件。

**规范：**
- 文档放在 `docs/for-framework-developers/` 或 `docs/for-tool-developers/`（按读者角色）
- 文件名使用 kebab-case
- 文件第一行以 `# 标题` 开头（作为文档标题）
- 不需要 frontmatter
- 所有文档**必须使用中文**撰写（custom instruction 要求）

## Audience 目录结构

```
docs/
├── for-framework-developers/   ← 框架维护者：runtime、shell、SDK、scaffold、docs
├── for-tool-developers/        ← 工具作者：创建 tool、SDK 使用、IO、export、渲染
│   └── ui-controls/            ← 共享 UI 组件使用指南
└── ideas/                      ← 工具创意 / draft plan（不作为主要导航入口）
```

`ideas/` 目录会出现在 docs browser 导航中，但不是面向开发者的指南。如果不希望 `ideas/` 进入导航，可以考虑把它移出 `docs/` 目录（当前决定保留在 docs 中以便在 browser 中可见）。

## Docs Browser 路由

```
src/routes/docs/
├── +layout.server.ts      ← load()：构建 catalog，传入 layout data
├── +layout.svelte         ← 整体布局（header + sidebar nav + main content 区）
├── +page.svelte           ← /docs 首页（显示 hasDocs / 空状态）
├── [   ...slug]/
│   ├── +page.server.ts    ← load({ params })：按 slug 查找文档
│   └── +page.svelte       ← 渲染 mdsvex 编译后的文档组件
└── components/
    └── DocsNavGroup.svelte ← 递归树形导航组件
```

`+layout.server.ts` 调用 `getDocsCatalog()`（来自 `src/lib/docs/metadata.ts`），返回全部 docs tree 和 entry count 给 layout。

Sidebar 导航：`+layout.svelte` 渲染 `data.docsTree`，递归展示 groups 和 docs 链接。目录结构直接映射为导航层级，不需要额外 metadata。

## 修改 Docs Browser UI

如果需要调整 docs 首页文案、导航样式或 header 信息：
- 首页：`src/routes/docs/+page.svelte`
- 整体布局/侧边栏：`src/routes/docs/+layout.svelte`
- 树形导航节点：`src/routes/docs/components/DocsNavGroup.svelte`

这些是 framework internal 组件，tool 不应依赖或修改它们。

## Catalog 测试

`src/lib/docs/catalog.test.ts` 测试 `buildDocsCatalog()` 的核心逻辑（slug 生成、tree 构建、title 提取、findDocBySlug）。当 docs 目录结构调整后，需要更新测试中的 fixture 路径以反映新结构。

```bash
npm run test
```
