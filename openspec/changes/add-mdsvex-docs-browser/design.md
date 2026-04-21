## Context

当前仓库已经把开发者文档整理到根目录 docs 下，并按 guides、architecture、analysis 等主题分层，但应用运行时仍只有工具工作区，没有面向这些 Markdown 文档的浏览入口。与此同时，现有站点使用 SvelteKit + adapter-static，并在根布局中启用了 `prerender = true`，这意味着新增的文档能力必须兼容静态构建，不适合依赖运行时文件系统读取。

这次变更同时跨越三层：

- 工作区壳层：需要在右上角 Header 增加 Docs 顶层入口。
- 内容构建链路：需要把 docs 目录中的 Markdown 变成站内可访问页面。
- 文档浏览体验：需要根据文件夹结构构建导航树，并在独立页面中渲染内容。

约束包括：

- 共享 UI 文案保持英文。
- 文档源继续以根目录 docs 为准，不把文档手工复制到 src/routes。
- 新入口必须以新标签页打开，不能打断当前 workspace 的工具状态。
- 现有项目使用 adapter-static，因此文档页面必须可在构建时确定并产出。

## Goals / Non-Goals

**Goals:**
- 为当前工作区增加 Docs 顶层入口，允许开发者从应用内直接打开文档页。
- 使用 mdsvex 将 docs 目录中的 Markdown 编译为可在 SvelteKit 中渲染的内容。
- 基于 docs 文件夹层级生成稳定的目录树，使文档页具备按主题导航的能力。
- 提供 `/docs` 根入口与具体文档 URL，使文档页面可被单独访问和静态产出。
- 保持当前工具工作区与文档浏览页解耦，避免 Docs 功能污染 ToolShell 运行模型。

**Non-Goals:**
- 不在本次把文档系统拆成独立站点或引入第二套静态站生成器。
- 不在本次加入全文搜索、版本化文档、多语言切换或评论系统。
- 不改变 docs 现有主题分类规则以外的内容治理流程。
- 不把 Markdown 作者体验扩展到复杂插件链，例如代码沙箱、交互式组件嵌入。

## Decisions

### 决策 1：采用 mdsvex 直接接入当前 SvelteKit，而不是引入独立文档站
- 方案：在现有 SvelteKit 项目中接入 mdsvex，把 Markdown 作为站内内容源进行编译与渲染。
- 原因：
  - 用户要求明确指向 mdsvex。
  - Docs 入口位于当前工作区右上角，内聚在同一应用里比跳到第二个文档工程更直接。
  - 共享现有构建、部署、样式 token 与静态产物流程，降低维护面。
- 备选方案：使用 VitePress 或 Starlight 单独搭建文档站。
  - 放弃原因：需要额外站点和部署入口，也无法自然复用当前工作区 Header 中的产品内跳转语义。

### 决策 2：继续以根目录 docs 作为单一文档源，通过 manifest 模块收集内容
- 方案：保留 docs 目录为唯一内容源，使用 `import.meta.glob` 收集 `docs/**/*.md`，在 `src/lib/docs/` 下生成运行时使用的 catalog/tree 数据与文档加载器。
- 原因：
  - 避免把现有文档复制到 routes 或 content 子目录，消除双份内容风险。
  - 目录树可直接从真实文件夹结构派生，符合“根据文件夹结构为目录”的目标。
  - 与 mdsvex 结合后，每篇 Markdown 可被编译成 Svelte 组件并按需加载。
- 备选方案：把所有文档迁移到 `src/routes/docs/**/+page.md`。
  - 放弃原因：会打破当前 docs 目录的组织方式，也提高后续维护成本。

### 决策 3：文档浏览采用独立 `/docs` 路由壳层，而不是复用 ToolShell
- 方案：新增文档页专用布局，例如 `/docs` 及其子路径，使用左侧目录树 + 右侧正文的阅读布局；该布局复用全局 token 与基础 UI，但不复用 ToolShell、Tabs、LeftPanel/RightPanel 运行契约。
- 原因：
  - 文档浏览不是工具实例，不应落入 tool runtime、tab persistence、hash tool routing 模型。
  - 单独布局更适合目录导航、正文排版和外链打开场景。
  - 可避免把文档页误当成 tool，保持壳层职责边界清晰。
- 备选方案：把 Docs 做成一个普通 tool。
  - 放弃原因：文档浏览不需要 tool registry，也不应占用工作区标签页和当前工具状态。

### 决策 4：Header 中的 Docs 入口使用真实链接并以新标签页打开 `/docs`
- 方案：在 workspace Header 增加 Docs 控件，点击后通过标准链接打开 `/docs`，带 `target="_blank"` 与安全相关属性，避免修改当前页状态。
- 原因：
  - 满足用户要求的“跳转到新标签页”。
  - 不触发当前 workspace 的 tab、hash、dialog 状态变化。
  - 浏览器原生行为比脚本式 `window.open` 更稳定，也更易测试。
- 备选方案：在当前页内直接路由到 `/docs`。
  - 放弃原因：会打断当前正在使用的工具上下文，不符合预期。

### 决策 5：静态产出通过“docs 路由 + 枚举 entries”实现，而不是依赖运行时解析文件系统
- 方案：文档 slug 从 docs catalog 中派生，并通过路由 entries 在构建时枚举所有文档 URL；`/docs` 根页负责默认欢迎态或默认选中文档，`/docs/<section>/<name>` 负责具体文档阅读。
- 原因：
  - 当前项目使用 adapter-static 且全局 prerender，必须在构建期知道要输出哪些页面。
  - entries 可以把 docs 文件集合映射成静态页面集合，避免 404 或 fallback 依赖。
  - 路径语义与真实目录结构一致，链接可读性更强。
- 备选方案：使用单页 `/docs` + 查询参数选择文档。
  - 放弃原因：URL 语义较弱，不利于直接分享具体文档，也不利于静态页面级导航。

### 决策 6：目录树与文档元信息在构建时标准化，正文渲染保持最小增强
- 方案：在 docs manifest 中为每篇文档生成 slug、标题、分组、相邻导航等元数据；正文渲染优先使用 mdsvex 默认 Markdown 能力与项目基础样式，不在本次引入复杂 remark/rehype 插件链。
- 原因：
  - 可以先稳定实现“能按目录浏览并阅读”的核心能力。
  - 避免把本次变更扩展成一套完整内容平台。
  - 标准化元数据后，后续增加 breadcrumb、最近文档、搜索索引会更容易。
- 备选方案：完全在运行时从组件导出中推断导航信息。
  - 放弃原因：目录、排序和空状态处理会分散到多个页面，维护性差。

## Risks / Trade-offs

- [风险] mdsvex 接入会修改 SvelteKit 配置与文件扩展识别，可能影响现有构建链路。  
  → Mitigation: 仅把 Markdown 扩展纳入新增文档链路，先以最小配置接入，并用 `npm run build` 验证现有工具工作区无回归。

- [风险] docs 内容位于 src 之外，若 glob 或构建路径配置不当，可能出现开发环境可读而构建环境失效。  
  → Mitigation: 在 manifest 层集中管理 glob 入口，并为 catalog 生成与静态 route entries 增加测试或构建验证。

- [风险] 路由数量会随文档增多而增加，静态构建时间和产物数会上升。  
  → Mitigation: 当前 docs 规模很小，先接受静态枚举策略；后续若文档规模增长，再评估拆站或索引优化。

- [风险] 文档页如果完全复用工具样式，阅读体验可能受工具型布局影响。  
  → Mitigation: 仅复用 token 与基础组件，文档页使用独立布局和排版样式。

- [风险] Header 新增 Docs 按钮会修改既有 tool-shell-workspace 规格与 UI 认知。  
  → Mitigation: 通过 spec delta 明确新顶层操作集合，并保持 Open、Help、Settings 原行为不变。

## Migration Plan

1. 在依赖与 SvelteKit 配置中接入 mdsvex，并确保 Markdown 文件可以被项目编译。
2. 新增 docs manifest 与目录树构造模块，把根目录 docs 统一映射为 slug、分组与加载器。
3. 新增 `/docs` 文档浏览路由及其布局、目录树、正文阅读区域与空状态。
4. 在 workspace Header 中增加 Docs 顶层入口，指向 `/docs` 并以新标签页打开。
5. 运行构建验证静态页面产出正常，并检查已有 workspace 页面与工具加载不受影响。
6. 如集成出现严重构建回归，可先回退 mdsvex 配置与 docs 路由，保留 docs 目录整理结果不变。

## Open Questions

- `/docs` 根页首次打开时应显示欢迎页，还是自动跳转到第一篇文档？
- 目录树排序是否完全遵循文件系统顺序，还是按主题目录名和文档标题做稳定排序？
- 是否需要为 Markdown 正文中的代码块补充语法高亮，还是先保持浏览器默认渲染样式？