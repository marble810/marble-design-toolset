# Host 与 Tool 的 seam

> 本文描述 MAB-65 的目标设计。当前代码仍处于迁移期，完整 architecture 见 [`../architecture/deshelf-architecture.md`](../architecture/deshelf-architecture.md)。

## 核心原则

Deshelf 通过两个不同阶段的 seams 隔离变化：

1. **构建 seam**：Tool Project 经 Deshelf Forge 产生 Catalog Entry 与 artifacts。
2. **运行 seam**：Deshelf Host 通过 Environment API 管理 Tool Container。

Catalog 让 Host 在启动 Container 前就能建立 Parameter Store 与 Standard Inspector；Environment API 只承载低频管理消息。这样将复杂构建与运行 implementation 藏在少量 deep interfaces 后，调用方获得 leverage，维护者获得 locality。

## Deshelf Forge 拥有

- Tool Manifest validation；
- 固定 Tool Entry 编译；
- Parameter、Command、Inspector Tree 与 Surface descriptor extraction；
- Main/Slate artifacts；
- Catalog Entry upsert；
- `.deshelf/` IDE types/schema 生成。

## Deshelf Host 拥有

- Catalog consumption 与 Tool Source adapters；
- Workspace shell、MainInfo 与 Tool Info；
- Tool Session lifecycle；
- Host-owned Parameter Store；
- Standard Inspector rendering；
- Environment Inventory；
- Asset Input、Export 与 diagnostics implementation；
- Web/Desktop Tool Container adapter interface；
- Reload、Restart 与 Reset。

## Visual Tool 拥有

- Tool Project 内部源码组织；
- Parameter/Command/Inspector definitions；
- simulation 与 renderer implementation；
- Main artifact callbacks；
- Canvas；
- 可选 Tool Slate 的 DOM、Svelte、CSS 与局部状态；
- GPU/resource dispose logic。

Visual Tool 不拥有 Workspace shell、Standard Inspector、Parameter Store、Catalog 或 Host filesystem。

## 构建 seam

作者只登记：

```text
manifest.json  # identity + Forge environment
index.ts       # defineVisualTool definition
```

Forge 从 Tool Entry 抽取 Catalog Entry。Catalog 不保存函数、Svelte component、DOM 或 Framework Library objects。Tool Session 不发送 runtime Registration。

validation 分阶段进行：

| 阶段 | validation |
|---|---|
| Manifest | Deshelf identity、contractVersion、forgeProfile、Project ID、libraries |
| Extraction | Parameter ID/Constraint/dependency、Command ID、Inspector Binding、Surface |
| Artifact load | default export 与 runtime callbacks |
| Boot | protocolVersion、sessionId、endpoint role、Surface |
| Environment message | discriminated union/schema 与 active Session |

## 运行 seam

Environment API 使用 Web/Desktop 共用的 TypeScript union 与 runtime schema。启动只包含：

```text
Host → Container: boot
Container → Host: surface.ready
```

运行消息限于 Parameter、Command、Surface、Asset/Export adapter 和 diagnostic 管理。Pointer events、rAF、GPU objects、simulation state 与 Canvas pixels 不经过该 seam。

## Tool Container 的隔离承诺

Tool Container 提供环境供给、生命周期管理和 Session 间隔离，不承诺防御恶意 Tool：

- Web：same-origin iframe，可能与 Host 共用 renderer process；
- Desktop：WebContents + MessagePort，Runtime 无 Node 或任意 `ipcRenderer`；
- Main Container 运行 Tool Entry artifact + Canvas；
- Tool Slate 使用可选第二 Container；
- 两个 Containers 不共享 JavaScript realm。

不要引入 Capability Broker、Grant、message ACL、unique origin 或 runtime Registration 来恢复已放弃的对抗模型。

## Public 与 internal

Tool 作者只依赖 Deshelf Forge 提供的 Tool SDK interface。`tool-host`、`tool-builder`、Catalog Source adapters 与 transport adapters 均为 framework internal implementation。

新增 interface 前执行 deletion test：若删除 module 后复杂度不会重新散落到多个调用方，它就是 shallow module，不应成为新的 public seam。
