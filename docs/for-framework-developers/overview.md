# Deshelf 框架开发者指南

## 适用对象

本节面向维护 Deshelf Forge、Deshelf Host、Catalog、Tool Builder、Workspace 与 Web/Desktop adapters 的开发者。Tool 作者请阅读 [Tool developer 文档](../for-tool-developers/overview.md)。

> 旧的同 realm Svelte Tool runtime 已在 MAB-70 迁移完成后删除；当前仓库的生产路径即 Catalog-driven Tool Containers。目标设计见 [`../architecture/deshelf-architecture.md`](../architecture/deshelf-architecture.md)。

## 核心原则

- Forge 在构建期从 Tool Manifest 与 Tool Entry 生成 Catalog Entry。
- Host 仅凭 Catalog 建立 Parameter Store 与 Standard Inspector。
- Tool Session 不进行 runtime Registration。
- Main Container 运行 simulation 与 Canvas；可选 Slate Container 运行 Tool Slate。
- Environment API 是低频管理 seam，不承载 rAF、GPU、simulation state 或 Canvas pixels。
- Web/Desktop 共用 interfaces，只替换 Tool Source 与 transport adapters。
- Tool Container 提供环境隔离，不承诺防恶意代码或进程级故障隔离。

## 文档索引

| 文档 | 内容 |
|---|---|
| [Deshelf 目标架构](../architecture/deshelf-architecture.md) | Catalog、Tool Containers、Environment API 与 migration 总设计 |
| [现有代码迁移分析](../architecture/current-code-migration-analysis.md) | 当前 modules 的保留、替换、删除与 implementation 顺序 |
| [Host 与 Tool 的 seam](./host-tool-boundary.md) | Forge/Host/Tool ownership 与 validation 时机 |
| [Web same-origin iframe adapter](./web-iframe-adapter.md) | 静态 Catalog 生成、iframe Container、transport 与 conformance tests |
| [Desktop WebContents + MessagePort adapter](./desktop-adapter.md) | Open Project、AppData cache、受控 Builder、Catalog 持久化、realm 生命周期与 Asset/Export adapters |
| [Tool SDK interface](./public-sdk.md) | `defineVisualTool`、Inspector descriptor 与 Environment client |
| [Runtime 与 Workspace](./runtime-and-shell.md) | Session lifecycle、Parameter flow、Reload 与 adapters |
| [Scaffolding and recipes](./scaffolding-and-recipes.md) | Tool Project 参考实现与共享构建流水线维护 |
| [Docs system](./docs-system.md) | 文档 catalog、browser 与 audience 规则 |

## 目标 modules

| Module | 职责 |
|---|---|
| `packages/tool-contract/` | Manifest、Catalog descriptor、Environment API types/schema |
| `packages/tool-sdk/` | Tool author interface 与 Container client |
| `packages/tool-host/` | Catalog consumption、Session、Store、Inspector、adapter interface |
| `packages/tool-builder/` | 扫描、编译、extraction、Catalog generation |
| `apps/web/` | 静态 Catalog 与 iframe adapter |
| `apps/desktop/` | Open Project、Project Catalog 与 WebContents adapter |
| `tools/shallow-water/` | 第一份迁移样本 |

## Change 流程

1. 在 Linear 的 MAB-65 子 Issue 明确 scope 与 acceptance。
2. 为跨既有 OpenSpec contract 的变更创建中文 OpenSpec change。
3. 先实现共享 interface 与 conformance tests，再实现 Web/Desktop adapters。
4. 使用 Shallow Water 验证完整路径。
5. 运行 repository tests、contract validation 与 production build。
