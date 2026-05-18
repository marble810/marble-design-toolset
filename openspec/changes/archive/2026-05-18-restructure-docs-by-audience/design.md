## Context

当前 docs 目录仍然反映早期项目结构：`guides/Making Tools` 混合了承接 tool 作者的教程、framework public SDK 约束、IO/export/render host 等内容；`guides/Styles` 面向 UI 基线；`draft-plan` 承载工具想法；原本 README 指向的 `docs/architecture/project-architecture-analysis.md` 当前已经被删除。与此同时，最近一轮框架重构已经明确了两类读者：

- **Framework developers**：维护 workspace shell、runtime、SDK surface、OpenSpec contracts、docs browser、scaffold 与 capability implementation。
- **Tool developers**：通过 public SDK、recipes、shared UI、IO/export/lifecycle capability 创建和维护 tool。

这两类读者的上下文重叠但目标不同。文档需要跟随框架边界重构，否则“host-tool boundary”只在代码中存在，文档入口仍会鼓励读者穿透边界。

## Goals / Non-Goals

**Goals:**
- 将 docs 顶层信息架构调整为 audience-first。
- 让 framework developer 与 tool developer 都能从最短路径进入对应文档。
- 移除或替换 README 中失效的架构文档引用。
- 保持 docs browser 继续基于真实 docs 文件夹层级生成导航。
- 尽量通过移动、拆分、重写现有文档完成，而不是引入新文档系统。

**Non-Goals:**
- 不实现 frontmatter、标签过滤或搜索系统。
- 不改变 mdsvex / SvelteKit docs route 的基本渲染方式。
- 不在本次重写 OpenSpec specs 的全部正文。
- 不将 draft tool idea 文档升级为正式 tool 开发指南。

## Decisions

### 决策 1：采用 audience-first 顶层目录

目标目录结构采用：

```text
docs/
├── for-framework-developers/
│   ├── overview.md
│   ├── host-tool-boundary.md
│   ├── public-sdk.md
│   ├── runtime-and-shell.md
│   ├── scaffolding-and-recipes.md
│   └── docs-system.md
├── for-tool-developers/
│   ├── overview.md
│   ├── create-a-tool.md
│   ├── recipes.md
│   ├── file-input.md
│   ├── export.md
│   ├── pixi.md
│   ├── three.md
│   └── ui-controls/
└── ideas/
```

相比继续保留 `guides/Making Tools`，audience-first 更符合新的 host-tool boundary：tool 作者默认看 public API 与 recipes；framework 维护者再看 internal runtime 和演进文档。

### 决策 2：保留 docs browser 的目录驱动模型

当前 docs catalog 已经按真实目录构建导航，不需要额外 metadata 系统即可表达 audience groups。因此本次不引入 frontmatter，只要求 `/docs` 首页和 README 明确把两个顶层目录作为主要入口。

### 决策 3：文档内容按“归属者”而不是“技术名词”移动

同一个技术名词可能有两种视角：
- public SDK 对 tool developer 是使用手册；
- public SDK 对 framework developer 是兼容性与边界维护说明。

因此文档拆分时不能只按 `sdk`、`io`、`export` 等技术名词分类，而要明确写给哪个读者。必要时同一 capability 可以拥有两个文档：一个 tool-facing usage guide，一个 framework-facing maintenance guide。

### 决策 4：README 只保留短入口，详细内容下沉到 docs

README 应该说明项目定位、开发命令、两类文档入口和当前质量门禁，不再承担长篇架构分析。这样 README 不会因为 docs 重构频繁过时。

## Risks / Trade-offs

- **[Risk] 移动文档导致旧链接失效** → Mitigation：README 和 docs 首页同步更新；必要时保留短的迁移提示文档或 redirect-style placeholder。
- **[Risk] 同一内容在两个角色下重复维护** → Mitigation：tool-facing 文档讲用法，framework-facing 文档讲 contract 和演进，避免复制同一正文。
- **[Risk] docs browser 排序无法突出两个主入口** → Mitigation：如目录自然排序不够清晰，可在 catalog 层为 audience groups 增加稳定排序规则。
- **[Risk] 当前已删除架构文档造成引用断裂** → Mitigation：本次明确替换 README 和 docs 入口中的旧引用，不恢复旧文件。

## Migration Plan

1. 建立 `for-framework-developers/` 与 `for-tool-developers/` 顶层目录。
2. 移动并重命名现有 Making Tools、Styles、draft-plan 文档到新结构。
3. 为两个角色各补一个 overview 文档。
4. 更新 README、docs 首页和内部相对链接。
5. 补充 catalog/docs route 测试，确认移动后 slug、导航和空/缺失状态仍正确。

## Open Questions

- 是否需要保留旧路径下的 placeholder 文档，帮助已有链接迁移。
- `ideas/` 是否应进入公开 docs 导航，还是留在仓库内但不作为 docs browser 主入口。
