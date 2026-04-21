## Why

当前工具运行时会把所有存在 metadata.json 的工具都纳入 catalog，并默认视为可打开的合法工具。这使得实验性工具、暂时下线的工具或尚未准备对外展示的工具只能通过改动运行时逻辑或直接移走目录来处理，缺少一个低成本、可声明式的硬开关。

这次变更希望在不调整 index.ts 运行时合约的前提下，为每个工具增加一个 metadata 级别的 enabled 布尔开关，用来统一控制工具是否进入工具架与运行时可用集合，从而降低工具上架、下线和灰度整理的维护成本。

## What Changes

- 在工具 metadata 中增加 enabled 布尔字段，作为工具可用性的硬开关。
- 当 enabled 为 false 时，工具不会进入 workspace 的工具架列表，也不会被视为可打开的合法工具。
- hash 路由与本地持久化恢复在处理工具 ID 时，同步排除 enabled 为 false 的工具，避免恢复到已下线工具。
- 保持现有 index.ts、懒加载组件和 tech stack 声明机制不变，不引入新的 tool runtime 入口约定。
- 更新对应规范与开发文档，明确 enabled 字段的语义、默认行为与使用场景。

## Capabilities

### New Capabilities
- 无

### Modified Capabilities
- `tool-module-runtime`: 工具 metadata discovery 与运行时合法工具集合需要支持 enabled 硬开关，并在 catalog、打开校验、hash 恢复中统一生效。

## Impact

- 受影响代码主要包括工具类型定义、工具注册表、workspace 初始状态解析与工具列表展示链路。
- 受影响文档包括 tool 开发指南，以及与 tool runtime 合约相关的 OpenSpec 规格说明。
- 不涉及新增外部依赖，也不改变现有 tool 目录 schema 与 index.ts 合约。