## Why

近期框架重构已经把 host-tool boundary、public SDK、tool IO、host lifecycle 和 capability recipes 等概念落地，但现有文档仍按历史主题散落在 `guides/Making Tools`、`guides/Styles`、`draft-plan` 等目录中。继续沿用旧结构会让 framework developer 和 tool developer 看到彼此不需要的上下文，削弱新边界带来的清晰性。

## What Changes

- 将 `docs/` 重构为面向读者角色的顶层结构，至少包含 `for-framework-developers/` 与 `for-tool-developers/` 两个入口。
- 为 framework developers 提供框架维护、host-tool boundary、SDK surface、runtime、shell、docs browser、OpenSpec 演进等文档入口。
- 为 tool developers 提供创建 tool、选择 recipe、使用 public SDK、IO、export、Pixi/Three/lifecycle、UI 组件等文档入口。
- 更新 README 和 docs 浏览器入口，避免继续指向已删除或旧路径的架构文档。
- 保留 docs browser 的真实目录映射能力，不引入 frontmatter 或独立文档路由系统。

## Capabilities

### New Capabilities
- `docs-audience-structure`: 定义文档按读者角色拆分后的信息架构、入口命名和内容归属。

### Modified Capabilities
- `workspace-docs-browser`: 扩展文档浏览器导航要求，使其能清楚呈现 audience-first 的顶层分组，并为 `/docs` 首页提供面向角色的入口说明。

## Impact

- `docs/`
- `README.md`
- `src/lib/docs/`
- `src/routes/docs/`
- `src/lib/docs/catalog.test.ts`
- `openspec/specs/workspace-docs-browser/spec.md`
