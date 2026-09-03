## Why

当前框架把 Tool discovery、runtime definition、master Svelte、Workspace panels、Parameter state 与 export registration 绑在同一 Svelte realm。该 interface 无法同时支持 Deshelf Web 的构建期 Tool 与 Deshelf Desktop 的 Open Project，也让 Tool 承担 Host 布局和生命周期职责。

需要改为 Catalog-driven architecture：Deshelf Forge 在构建期抽取可序列化 descriptor，Deshelf Host 先建立 Parameter Store 与 Standard Inspector，再通过轻量 Environment API 启动 Tool Container。性能热路径留在 Container 内。

## What Changes

- Tool Project 改为根 `manifest.json` + 固定 `index.ts` 两个登记点。
- Deshelf Forge 在构建期编译 Tool Entry、抽取 Parameter/Asset/Command/private callback/Visual Output/Inspector/Surface descriptors，并生成 Catalog Entry 与 Main/Slate artifacts。
- Web 生成静态 Catalog；Desktop Open Project 更新 Project Catalog。两端共享 Catalog Entry interface。
- Deshelf Host 仅凭 Catalog Entry 创建 Parameter Store 与 Standard Inspector。
- Main Container 运行 Tool Entry callbacks、simulation 与 Canvas；可选 Slate Container 运行 Tool Slate。
- Host 与 Container 仅通过 Environment API 交换 Parameter、Command、Surface、Asset/Export adapter 与 diagnostics 管理消息。
- Session 启动收敛为 `boot → surface.ready`，删除 runtime Registration 与 capability negotiation。
- Reload 使用 staged migration 和并行 replacement，成功后原子切换。
- Asset Input 与 Visual Output 由 Tool Entry named maps 声明；禁止 Canvas mount 后 runtime 注册 exporter。
- Inspector private callback 由 Tool Entry `privateCallbacks` named map 提供稳定 ID。
- Shallow Water 成为唯一迁移与验收 Tool。

## Capabilities

### New Capabilities

- `tool-catalog`: 构建期生成并消费 Catalog Entry。
- `tool-environment-api`: Web/Desktop 共用的 Tool Container 管理 interface。

### Modified Capabilities

- `tool-module-runtime`: Tool Project schema、Tool Entry、Framework Library 与加载方式改为 Catalog-driven。
- `host-tool-boundary`: Host/Forge/Tool ownership 改为 Tool Container 与 Environment API seams。
- `tool-session-lifecycle`: Session lifecycle 改为 Cataloged、HostReady、Booting、Ready/Failed、Closed，并支持 staged Reload。
- `tool-sdk-surface`: SDK 改为 `defineVisualTool`、Inspector descriptor 与 Environment client，不再暴露同 realm contexts/layout。

## Impact

- 新增 `packages/tool-contract`、`tool-sdk`、`tool-host`、`tool-builder` 的目标 modules 与 Web/Desktop adapters。
- 替换 `src/lib/runtime/tool-registry.ts`、旧 `ToolDefinition`、同 realm ToolSession 和 runtime Svelte contexts。
- 替换 `metadata.json`、root master Svelte、Tool-owned LeftPanel/RightPanel 与 runtime exporter registration。
- 更新 framework/tool author 文档、contract validation、scaffold 与 conformance tests。
- 迁移并保留 Shallow Water simulation/renderer；移除其他旧 Visual Tools。
