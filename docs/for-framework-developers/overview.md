# 框架开发者指南

## 适用对象

本节文档面向维护 Marble Design Toolset 框架本身的开发者。这包括：workspace shell、runtime 能力实现、public SDK surface、脚手架与 recipes、docs browser、以及 host-tool boundary 演进。

如果你只是在开发一个新 tool，请阅读 [tool developer 文档](../for-tool-developers/overview.md)。

## 关键原则

Framework 只负责：
- Tool 发现、加载和路由
- Workspace shell 与布局
- 公共 runtime 能力（IO、export、lifecycle）的实现
- Host-tool boundary 的定义和执行
- Public SDK 的维护与兼容性

Framework **不管理**：
- Tool 的内部状态设计
- Tool 的内部组件拆分和渲染细节
- Tool 的代码风格和抽象层次

## 文档索引

| 文档 | 内容 |
|---|---|
| [host-tool-boundary.md](./host-tool-boundary.md) | Host-tool boundary charter：职责边界、public/internal 分层、contract validation |
| [public-sdk.md](./public-sdk.md) | 维护 public SDK surface：现有 exports、如何添加新 API、兼容性策略 |
| [runtime-and-shell.md](./runtime-and-shell.md) | Runtime 架构：tool registry、shell 结构、capability 协议 |
| [scaffolding-and-recipes.md](./scaffolding-and-recipes.md) | 脚手架系统：如何添加 recipe、模板约定、scaffold 测试 |
| [docs-system.md](./docs-system.md) | Docs catalog 和 browser：如何维护文档目录、audience 结构约定 |

## 开发命令

```bash
npm run dev          # 开发服务器
npm run build        # 生产构建（运行 validate.mjs + vite build）
npm run test         # 全量测试（Node test runner）
bun run create:tool  # 交互式 tool 脚手架

# 手动运行 tool contract validation
node scripts/tool-contract/validate.mjs
```

## 核心目录

| 目录 | 职责 |
|---|---|
| `src/lib/tool-sdk/` | Public tool SDK — tool 作者的唯一稳定入口 |
| `src/lib/runtime/` | Framework internal runtime（IO、export、lifecycle、file-input、render-host 等） |
| `src/lib/components/shell/` | Workspace shell 布局组件（ToolShell、LeftPanel、RightPanel 等） |
| `src/lib/components/ui/` | Shared UI primitive 组件（Button、SliderField、PixelIcon 等） |
| `scripts/tool-contract/` | Tool schema 和 boundary import 的 contract validation |
| `scripts/tool-scaffold/` | 脚手架模板与 recipe 逻辑 |
| `src/routes/docs/` | Docs browser SvelteKit 路由 |
| `src/lib/docs/` | Docs catalog 构建与 Markdown 加载逻辑 |

## 添加新框架能力的流程

1. 先在 `openspec/changes/` 创建一个新 change（`openspec new change "<name>"`），写清楚 proposal/design/specs。
2. 在 `src/lib/runtime/` 内实现能力，保持 internal 路径不对外承诺稳定。
3. 在 `src/lib/tool-sdk/index.ts` 决定是否暴露 public surface——只暴露 tool 真正需要的部分。
4. 更新脚手架模板（`scripts/tool-scaffold/templates/index.js`）使其优先使用新的 public API。
5. 更新 `docs/for-tool-developers/` 中对应的使用文档。
6. 运行 `npm run test` 和 `npm run build` 验证。
