## ADDED Requirements

### Requirement: 文档浏览器突出 audience-first 分组
文档浏览器 SHALL 在 `/docs` 入口和导航结构中清楚呈现 audience-first 顶层分组，至少包括 framework developers 与 tool developers 两类入口。浏览器 MUST 继续基于 docs 真实目录结构生成导航，且不得要求文档添加 frontmatter 才能进入导航。

#### Scenario: 用户打开 docs 首页
- **WHEN** 用户访问 `/docs`
- **THEN** 页面显示面向 framework developers 和 tool developers 的主要入口，并保留目录导航

#### Scenario: Docs 目录按角色重组
- **WHEN** docs 目录中存在 `for-framework-developers/` 与 `for-tool-developers/`
- **THEN** 文档浏览器导航显示这两个顶层分组，而不是把文档扁平化或混入旧的 guides 分组

### Requirement: 文档移动后路由清单保持稳定生成
当 Markdown 文档在 docs 目录内移动或重命名时，文档浏览器 SHALL 根据新的真实路径生成 slug 与路由清单。无效旧路径 MUST 显示现有的 not found 反馈，而不是导致构建或页面渲染失败。

#### Scenario: 文档从旧 guides 路径移动到 audience 路径
- **WHEN** 某篇 Markdown 文档从 `docs/guides/...` 移动到 `docs/for-tool-developers/...`
- **THEN** 文档浏览器为新路径生成新的 slug，并能正常渲染该文档

#### Scenario: 用户访问旧路径
- **WHEN** 用户访问已不存在的旧 docs slug
- **THEN** 文档浏览器显示未找到反馈，并保留可返回新文档导航的入口
