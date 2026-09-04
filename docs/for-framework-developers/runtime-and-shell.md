# Runtime 与 Workspace architecture

> 本文描述 Catalog-driven runtime architecture。旧同 realm runtime（`tool-registry.ts`、Svelte tool contexts、Tool-owned panels 与旧 canvas-export registry）已在 MAB-70 迁移完成后删除。

## Workspace

Deshelf Web 根路由（`/`）即 Catalog-driven Tool Host：加载构建期生成的静态 Catalog、列出可用 Entry，并以 Host chrome（Standard Inspector、Asset Input、Export、Restart/Reload/Reset）打开 Tool。

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

- Asset Input 与 Visual Output 的选择/执行都由 Host 编排；Container 只拿到可读内容 URL（Web：blob URL；Desktop：`deshelf-cache://` opaque URL，真实路径不进 Tool）。
- Visual Output 的 render/encode 在 **Main Container** 内执行（参考 `tools/shallow-water/sim/export-replay.ts`）；Host 拿到编码后的 Blob 负责下载/写盘确认。
- 旧的同 realm file-input / canvas-export / render-host runtime 已删除；Container 内的生命周期由 Tool 私有 runtime 模块负责（shallow-water 的 `sim/runtime.ts` 是参考实现）。

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
