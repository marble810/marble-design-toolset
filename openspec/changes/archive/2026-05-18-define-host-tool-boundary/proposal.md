## Why

当前仓库已经开始拆分 SDK surface、lifecycle、recipes 和 IO facade，但还缺少一条更上层的“框架开发与工具开发互不影响”总规范。若没有统一的 host-tool boundary，框架内部重构仍会不断泄漏成 tool contract，而 tool 的实现也可能反向耦合到壳层和 runtime internals。

## What Changes

- 新增一条 `host-tool-boundary` capability，明确 host owns / tool owns、public API / internal API、extension points / capabilities、兼容策略与隔离分级。
- 规定 tool 只能通过 public SDK 和声明过的 capability 接入 framework，不把 internal 模块路径视为长期 contract。
- 把“互不影响”落实为可执行规则：脚手架默认只生成 public API 用法，contract validation 增加 boundary 检查，framework 改 public API 时必须附带迁移路径。
- 为未来更强隔离预留分级模型：当前以 trusted in-repo tool 为默认层级，后续可演进到可选 sandbox，而不把当前仓库强行推向重沙箱架构。

## Capabilities

### New Capabilities
- `host-tool-boundary`: 定义 framework 与 tool 之间的职责边界、公共扩展面、失败隔离和隔离分级策略。

### Modified Capabilities
- `tool-module-runtime`: 增加 tool 只能依赖 public host boundary、以及 boundary 校验自动化的要求。
- `tool-scaffolding`: 增加脚手架模板默认使用 public SDK / capability 入口而不是 internal 模块路径的要求。

## Impact

- `src/lib/runtime/`
- `src/lib/types/`
- `scripts/tool-scaffold/`
- `scripts/tool-contract/`
- `docs/guides/Making Tools/`
- `openspec/specs/tool-module-runtime/spec.md`
- `openspec/specs/tool-scaffolding/spec.md`
