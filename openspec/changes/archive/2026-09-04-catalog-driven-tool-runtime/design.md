## Context

Deshelf 必须让 Web 与 Desktop 运行同一 Tool Project。Web Visual Tool 在应用构建期预编译；Desktop 通过 Open Project 调用相同 Builder core。当前 runtime `import.meta.glob + ToolDefinition.loadComponent + Svelte context` 把 discovery、Host layout、Tool runtime 和 framework capability 放在同一 implementation 中，缺少可复用 seam。

本设计以性能优先。Tool Container 用于环境供给、生命周期与 Session 间隔离，不按恶意第三方插件设计。完整目标 architecture 见 `docs/architecture/deshelf-architecture.md` 与 Linear MAB-65。

## Goals / Non-Goals

**Goals:**

- Web/Desktop 共用 Tool Manifest、Tool Entry、Catalog Entry、Environment API 与 Session semantics。
- Host 在 Container 启动前建立 Parameter Store 与 Standard Inspector。
- simulation/GPU/Canvas 热路径留在 Container。
- Forge 承担确定性的 build-time extraction。
- Reload 新版本失败时保留旧 Session。

**Non-Goals:**

- Capability Declaration/Grant/Broker 或 message ACL。
- runtime `tool.register`、hello/welcome negotiation、nonce、unique origin。
- Tool 第三方 package、自定义 Vite、JSON/UXML Inspector。
- runtime 动态增删 Parameter Set。
- Canvas ↔ Slate 私有 bus。
- Tool 私有 runtime state serialization。

## Decisions

### 1. 使用构建期 Catalog 替代 runtime Registry

作者只维护根 `manifest.json` 与固定 `index.ts`。Forge 编译 Tool Entry，在受控 extraction realm 中执行 descriptor-only `createInspector`，生成 Catalog Entry 与 artifacts。Catalog 不包含函数、DOM、Svelte 或 Framework Library objects。Tool Entry 通过 `assets` 与 `outputs` named maps 声明 Asset Slots 和 Visual Outputs；descriptors 进入 Catalog，runtime callbacks 留在 Main artifact。

Ownership 分界：`tool-sdk` 只提供 inert `defineVisualTool` declarations、typed handles 与 Inspector builders；它不加载 Tool Entry、不拥有 realm/timeout，也不生成 Catalog。`tool-builder` 拥有编译、受控执行、调用 `createInspector`、读取 SDK declaration/AST、validation、artifact emission 与 Catalog upsert。

Web 与 Desktop 通过两个 Tool Source adapters 提供相同 Catalog interface，因此该 seam 是真实的。删除 `tool-registry.ts`，不在其上叠加第二套 Catalog。

### 2. Catalog identity 区分逻辑身份与来源

`projectId` 表示可跨移动/重命名保持的逻辑身份；同一 Project ID 可以位于多个 Locations。Host 以 `CatalogSourceRef + projectId` 生成本地 `catalogEntryId`，Reload 只 upsert 当前来源对应记录。

### 3. Host 先进入 HostReady

Host 仅凭 Catalog descriptors 建立 Parameter Store 与 Standard Inspector。Main Container 启动不再承担 Registration。启动只有 `boot` request 与 Canvas `surface.ready` event。

这缩小了运行 interface，并使 Inspector 可以在 Tool artifact 加载前显示。

### 4. Main 与 Slate 使用两个 Containers

Main Container 运行 Tool Entry callbacks、simulation 与 Canvas。Tool Slate 是可选第二 Container，拥有自由 DOM/Svelte/CSS，但不与 Main 共享 JavaScript realm。Slate readiness 不阻塞 Canvas 第一帧；两者通过 Host Parameter Store 与 Tool Commands 协作。

### 5. Environment API 只做管理面

Environment API 使用 request/response/event union 与 runtime schema，覆盖 Parameter、Command、Surface、Asset/Export adapter 和 diagnostics。Endpoint role 由 transport channel 确定；Restart/Reload 创建新 sessionId，旧消息丢弃。

Pointer events、rAF、GPU objects、simulation state 与 Canvas pixels 不过 seam。控制消息保持小型化是性能卫生，不设固定安全上限。

### 6. Web same-origin，Desktop WebContents

Web 使用 same-origin iframe，以便供给预编译 artifacts 与 Framework Libraries；不承诺恶意代码或 process-level failure isolation。Desktop 使用 WebContents + MessagePort，Runtime 无 Node 或任意 `ipcRenderer`，真实文件路径不进入 Tool。

### 7. Parameter Store 由 Host 唯一持有

Standard Inspector 在 Host 本地响应 pointer input，经 rAF/pointerup 合并后发送 Parameter update。computed 由 Host 调度，Main 运行短函数且不得访问 GPU/IO。Tool Slate 修改 Parameter 也经过 Store。

### 8. Reload 使用 staged replacement

Host 先用新旧 descriptors 计算 staged Parameter/Asset migration，以 staged snapshot boot replacement。新 Canvas Ready 后才原子提交 Host state、切换 Session 并 dispose 旧 Container。失败释放 staged resources 并保留旧 Session；同时最多一套 replacement。

### 9. Inspector private callback 使用 named map

Tool Entry 的 `privateCallbacks` map key 是稳定 callback ID。Tool 作者在 `createInspector` 中绑定由 Forge 提供的 typed handle，不重复填写 ID。Catalog 只保存 Binding kind 与 callbackId，实际 callback function 留在 Main artifact。Forge 拒绝 inline anonymous private callback，并验证 Inspector Binding 与 Main callback table 一致。该选择避免 AST hoist、源码正则与 boot-time Tree replay。

## Risks / Trade-offs

- same-origin Web iframe 的死循环可能卡住 Host renderer；产品明确接受，不宣称完全隔离。
- build-time extraction 会成为关键 deep implementation，需要受控 realm、timeout 与 deterministic fixtures。
- named private callback 增加一次显式 Tool Entry 登记，但以较小作者成本换取确定性 extraction 与稳定 Reload compatibility。
- Catalog 与旧 runtime 在迁移期并存可能形成两套真相；迁移应替换旧 registry，不建立长期 compatibility layer。
- Slate 独立 realm 不支持直接共享 private simulation objects；v1 用 Host Store/Commands 换取清晰 seam。

## Migration Plan

1. 固定 `tool-contract` 中的 Manifest、Catalog、Parameter/Inspector descriptors 与 Environment API schema。
2. 实现 build-time extraction 与 static/project Catalog adapters。
3. 实现 Host Session core、Parameter Store 与 Standard Inspector。
4. 实现 Web iframe 与 Desktop WebContents adapters。
5. 迁移 Shallow Water，验证 Preview、Asset Input、Export、Reload/Restart/Reset。
6. 删除旧 registry、同 realm contexts、Tool-owned panels 与其他旧 Visual Tools。
7. 更新 tool author 文档与 scaffold。

回滚以迁移阶段为单位；在 Shallow Water 完成并通过双端 smoke tests 前，不删除旧 production path。

## Open Questions

- Catalog Entry 可选 Tool Info metadata 的最终字段集合。
- Environment API 中 Asset/Export 在 Web 与 Desktop 的 binary/stream adapter 细节。
