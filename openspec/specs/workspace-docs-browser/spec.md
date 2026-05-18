# workspace-docs-browser Specification

## Purpose
TBD - created by archiving change add-mdsvex-docs-browser. Update Purpose after archive.
## Requirements
### Requirement: 文档浏览器根据 docs 目录生成导航结构
文档浏览器 SHALL 使用仓库 docs 目录中的真实文件夹层级生成可浏览的目录结构，并在 `/docs` 入口中展示这些目录与文档项。

#### Scenario: 打开文档首页
- **WHEN** 用户访问 `/docs`
- **THEN** 页面显示基于 docs 目录结构生成的导航区域，并可区分 guides、architecture、analysis 等主题分组

#### Scenario: 目录中存在多个 Markdown 文档
- **WHEN** 某个 docs 子目录下存在多个 Markdown 文档
- **THEN** 导航区域展示该子目录及其下属文档项，而不是扁平化为单层无分组列表

### Requirement: 文档浏览器渲染可直接访问的 Markdown 文档页面
文档浏览器 SHALL 为每篇 docs 目录下的 Markdown 文档提供稳定的站内访问地址，并在文档页面中渲染其正文内容。

#### Scenario: 直接打开具体文档
- **WHEN** 用户访问某篇文档对应的站内地址
- **THEN** 页面渲染该 Markdown 文档的正文，并在导航区域标识当前活动文档

#### Scenario: 从目录中切换文档
- **WHEN** 用户在文档导航区域选择另一篇文档
- **THEN** 浏览器跳转到该文档的站内地址，并显示新文档内容

### Requirement: 文档浏览器提供稳定的缺失与空内容反馈
文档浏览器 SHALL 在没有可显示文档或访问路径无效时提供稳定的反馈界面，而不是渲染空白页面或崩溃。

#### Scenario: 文档目录暂时没有可展示内容
- **WHEN** 文档浏览器没有发现任何可展示的 Markdown 文档
- **THEN** `/docs` 页面显示明确的空状态说明

#### Scenario: 用户访问不存在的文档地址
- **WHEN** 用户访问未映射到任何 docs Markdown 文档的站内地址
- **THEN** 文档浏览器显示未找到反馈，并保留可返回其他文档的导航入口

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

