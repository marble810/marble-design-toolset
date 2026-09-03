# Runtime 与 Workspace architecture

> 本文描述 Catalog-driven 目标 architecture。迁移前实现中的 `tool-registry.ts`、同 realm Svelte contexts 与 Tool-owned panels 不是目标 interface。

## Workspace

Deshelf Host 拥有顶层 Workspace：

```text
Workspace
├─ MainInfo / Tool Info
├─ Standard Inspector
├─ Tool Slate slot（可选）
└─ Canvas slot
```

Visual Tool 不渲染 LeftPanel/RightPanel，也不重新定义 Workspace shell。Host 根据 Catalog Entry 的 Inspector Tree 创建 Standard Controls；Tool 只在 Main/Slate Containers 中渲染 Canvas 与 Tool Slate。

## Catalog-driven loading

```text
Tool Source Adapter
  → Catalog Entry
  → Host 创建 Parameter Store + Standard Inspector
  → Main Container boot
  → Canvas surface.ready
  → Tool Session Ready
  → 可选 Slate Container boot
```

Web Tool Source 在应用构建期生成静态 Catalog。Desktop Tool Source 在 Open Project 构建成功后更新 Project Catalog。两者满足相同 Catalog interface。

## Tool Session lifecycle

```text
Cataloged → HostReady → Booting → Ready
                         Booting → Failed
Ready | Failed → Closed
```

- **Cataloged**：Manifest、编译与 extraction 成功。
- **HostReady**：Parameter Store 与 Standard Inspector 已建立。
- **Booting**：Main Container 已收到 boot。
- **Ready**：Canvas 已发出 `surface.ready`。
- **Failed**：加载、版本、Entry error 或 startup timeout。

`Unresponsive` 是 Ready Session 的 health。Tool Command timeout 后 callback 仍不结束时，Host chrome 提供 Restart Tool。

## Tool Containers

```text
Tool Session
├─ Main Container（必需）
│  ├─ Tool Entry runtime definition
│  ├─ Parameter compute callbacks
│  ├─ Tool Command/private callbacks
│  ├─ simulation
│  └─ Canvas
└─ Slate Container（可选）
   └─ Tool Slate DOM/Svelte/CSS/local state
```

Slate Ready 不阻塞 Canvas 首帧；Slate failure 只产生 Surface diagnostic。v1 不提供 Canvas ↔ Slate 私有 bus，两者通过 Host Parameter Store 与 Tool Commands 协作。

## Environment API

Environment API 是低频管理 interface：

```text
parameter.snapshot | changed | set | compute
command.execute | cancel | result | status
surface.resize | dispose
asset.* | export.*
diagnostic.emit
```

Web/Desktop 共享 types/schema，只替换 transport adapter：

```text
EnvironmentTransport
├─ WebIframeAdapter
└─ DesktopMessagePortAdapter
```

Endpoint role 由 transport channel 确定。Restart/Reload 创建新 sessionId；旧 Session 消息丢弃。没有 hello/welcome、runtime registration、Grant、endpointId 或 per-message sequence。

## Parameter flow

Standard Inspector 的 pointer events 不进入 Environment API：

```text
pointer input
  → Host local display
  → rAF / pointerup coalescing
  → parameter.set(expectedRevision)
  → Store validation
  → parameter.changed to Main
```

Host 是 Parameter Store 唯一权威。computed 由 Host 调度，Main 运行短函数；compute callback 不访问 GPU/IO。

## IO 与 Export

现有 file-input、canvas-export 与 render lifecycle implementation 可以保留并深埋到 `tool-host`，但 Tool 不再通过同 realm Svelte context 注册。

- Environment Inventory 决定当前 Asset/Export adapters 是否存在。
- Web adapter 可以交付 blob 或用户选择结果。
- Desktop adapter 不向 Tool 暴露真实文件路径。
- Visual Output encoding、picker、drop parsing 与对象 URL cleanup 由 Host implementation 统一处理。

## Reload

Reload 先构建新的 Catalog Entry，再创建一套 replacement：

```text
new descriptor
  → staged Parameter/Asset migration
  → boot replacement with staged snapshot
  → replacement Canvas Ready
  → atomic commit + switch
  → dispose old Container
```

失败时释放 staged resources 并保留旧 Session。同时最多存在一套 replacement，避免并发 build 完成顺序覆盖更新。
