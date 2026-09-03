# 现有代码迁移分析

> 状态：MAB-65 目标 architecture 的 implementation map。本文回答“当前代码保留、改写、移动还是删除”，不把迁移前 implementation 提升为新 contract。

## 1. 结论

现有代码不适合沿 `ToolDefinition → ToolSession → Svelte context` 继续增量叠加 Catalog。正确策略是 **replace, not layer**：

1. 先在旧运行路径之外实现四个 deep packages 的 interface 与纯 core；
2. 用 generated Catalog + fake Container adapter 验证 Host core；
3. 接入 Web iframe 与 Desktop WebContents 两个真实 adapters；
4. 最后一次性把 Workspace composition root 切到新 Host；
5. 迁移 Shallow Water 后删除旧 registry、contexts、panels、scaffold 与其他 Visual Tools。

旧应用在新 tracer-bullet 可运行前保持可用，但旧 `tool-registry.ts` 不作为新 Catalog adapter，也不建立长期 compatibility layer。

## 2. 当前 implementation 的主要 coupling

### Discovery 与 loading

`src/lib/runtime/tool-registry.ts` 同时扫描 `metadata.json`、生成菜单 catalog、过滤 availability 并动态加载 `ToolDefinition`。`src/lib/components/shell/tool-session/ToolSession.svelte` 又同时承担 definition loading、Framework Library loading、三个 Svelte contexts、Tool Info dialog、retry UI 与 Tool component mount。

这两个 modules 的 interface 虽小，但 implementation 建立在错误 seam：Catalog 在 runtime 生成，Tool 与 Host 位于同一 Svelte realm。应整体替换，而不是向其添加 Catalog/Environment branches。

### Workspace identity

`workspace-controller` 与 `workspace-state` 以 `toolId` 作为 tab、hash 和 localStorage identity。目标需要 `catalogEntryId`，因为相同 Project ID 可存在于多个 Catalog Sources。纯 selection helpers 有保留价值，但持久化 schema 必须升级。

### Tool-owned Host state

`ShallowWaterHeight.svelte` 持有 Parameters、Asset source、preset、reset 与 resimulate token，并直接渲染 LeftPanel/RightPanel。`ShallowWaterPreview.svelte` 在同一 realm 获取 lifecycle、Framework Library 与 exporter registration。这正是目标 architecture 要删除的 ownership。

### IO 与 Export

现有 file-input implementation 已将 validation、reading、metadata 与对象 URL cleanup 拆成可注入 core，值得保留。外部 types 仍暴露 `File` 和 `objectUrl`，不能直接成为跨 Container interface。

Canvas export 的 PNG/video encoding 与 deterministic `renderFrame` 有保留价值；Svelte context、runtime exporter registry、DOM/canvas callback descriptor 则依赖同 realm，必须替换。

## 3. File disposition

### 3.1 替换后删除

| 当前文件/module | 处理 | 原因 |
|---|---|---|
| `src/lib/runtime/tool-registry.ts` | 删除 | runtime glob discovery 与 Catalog build-time extraction 冲突 |
| `src/lib/types/tool.ts` 中 `ToolDefinition`/`ToolMetadata`/`ToolCatalogItem` | 删除并改为 `tool-contract` types | 旧类型把 Manifest、Catalog、runtime callback 混在一起 |
| `src/lib/components/shell/tool-session/ToolSession.svelte` | 重写，不原地扩展 | 当前同时是 loader、session coordinator、context provider 与 UI |
| `src/lib/runtime/tool-runtime-context.ts` | 删除 | Tool 不再读取 Host same-realm context |
| `src/lib/runtime/tool-session-context.ts` | 删除 | active/resize/dispose 改走 Container-local client 与 Environment messages |
| `src/lib/runtime/tool-shell-context.ts` | 删除 | MainInfo/Inspector 由 Host 直接消费 Catalog/Session state |
| `src/lib/runtime/canvas-export/context.ts` | 删除 | 禁止 runtime exporter registration |
| `src/lib/runtime/canvas-export/registry.svelte.ts` | 删除 | Visual Outputs 改由 Tool Entry `outputs` named map 构建期登记 |
| `src/lib/runtime/tech-stack.ts` | 从 Host 删除 | Framework Libraries 应由 Forge Profile 编译/供给到 Container |
| `scripts/tool-contract/validate.mjs` 的旧 schema/regex validation | 替换 | `metadata.json`、root master Svelte 与 source regex 都是旧 contract |
| `scripts/tool-scaffold/` 的旧 recipes/templates | 替换 | 当前模板生成 Tool-owned panels、runtime contexts 与 exporter registration |
| `src/lib/runtime/layout-tool/` | 随旧 Layout tools 删除 | 当前只被旧 scaffold/Tool 使用，不应进入 v1 Host contract |

### 3.2 保留 implementation，放到新 interface 后面

| 当前文件/module | 处理 | 新位置/角色 |
|---|---|---|
| `src/lib/runtime/render-host/lifecycle-core.ts` | 保留纯 scheduler/cleanup core | `tool-sdk` Container-local lifecycle implementation |
| `src/lib/runtime/file-input/controller-core.ts` | 保留 ingest/replace/cleanup state machine | `tool-host` Asset implementation 内部 core |
| `src/lib/runtime/file-input/helpers.ts` | 保留 MIME/kind/size validation | Host Web/Desktop Asset adapters 共用 implementation |
| `src/lib/runtime/file-input/readers.ts` | 拆分保留 | browser reader adapter；跨 seam types 不暴露 `File`/Host object URL |
| `src/lib/runtime/canvas-export/png.ts`、`png16.ts`、`mp4.ts`、`mime.ts` | 保留 encoding logic | Main Container Visual Output runtime 或 Web export adapter |
| `src/lib/runtime/canvas-export/state.ts` | 保留 task/diagnostic ideas，改 descriptor types | `tool-host` Export UI/session implementation |
| `src/lib/components/ui/**` | 保留 | Standard Inspector 与 Host chrome primitives |
| `src/lib/components/shell/preview-canvas/zoom.js`、footer helpers | 保留 | Host Canvas slot 的 viewport/zoom logic |
| `src/lib/components/shell/main-info/MainInfo.svelte` | 保留并改输入 | 直接消费 Catalog Entry/Environment Inventory |
| `src/lib/runtime/workspace-state.ts` 的 selection/clamp logic | 保留算法并改 identity | `catalogEntryId`、v2 persistence schema、px panel width |

### 3.3 Host layout 改写

- `ToolShell.svelte` 保留“Host 拥有顶层 layout”的方向，但 slots 固定为 Standard Inspector、Tool Slate 与 Canvas Container；不再接受 Tool 提供整棵任意 children layout。
- `LeftPanel.svelte` 改为 Host Inspector column；删除 `getToolShellContext()` 与 metadata/export inference。
- `PreviewCanvas.svelte` 保留 pan/zoom/fit，但内容变为 Main iframe/WebContents surface adapter；Surface size change 由 Host 发送 `surface.resize`。
- `ExportSection.svelte` 保留 Host UI，输入改为 Session 的 Visual Output descriptors/status；不再读取 Canvas export Svelte context。
- `workspace-controller` 通过注入的 Catalog Source interface 获取 entries，不直接 import registry。

## 4. Shallow Water 迁移

### 4.1 直接保留

| 文件 | 处理 |
|---|---|
| `simulation/wave-renderer.ts` | 保留 shader、GPU ping-pong targets、deterministic stepping 与 dispose；Framework Library import 改为 Forge alias |
| `simulation/image-height.ts` | 保留 grayscale/height conversion；输入改为 Container-local Asset content/object URL |
| `simulation/parameters.ts` | 保留默认值与 renderer-specific derived calculations；合法性权威迁到 Host Parameter Store |
| `simulation/parameters.test.ts` | 保留数值行为测试，删除读取源码 regex 的 shader assertion |
| `src/lib/runtime/preset-init-map.ts` | 移入 Shallow Water Project | 当前只有 Shallow Water 使用，不是 framework concern |

### 4.2 替换

| 当前行为 | 目标行为 |
|---|---|
| `metadata.json` | 根 `manifest.json` |
| `ShallowWaterHeight.svelte` master | 根 `index.ts` Tool Entry + `canvas/Canvas.svelte` |
| `$state<ShallowWaterParameters>` | Host-owned flat Parameter Set |
| `createToolSourceInput()` | `assets.initMap` typed Asset Slot |
| `ShallowWaterControls.svelte` | `createInspector()` retained Inspector Tree |
| `resimulateToken` | `privateCallbacks.resimulate` |
| Tool-local Reset button | Host `Reset Defaults` command |
| `registerRenderExporter()` | `outputs.heightMap` Visual Output definition |
| `LeftPanel`/`RightPanel`/`PreviewCanvas` | Host Workspace slots |
| `$lib/runtime/*` imports | `@deshelf/tool-sdk`、`@deshelf/three` 与 Tool-private modules |

建议的 flat Parameters：

```text
sourceMode
presetKind
presetMode
presetCenterX
presetCenterY
presetSize
presetOutlineWidth
presetPosition
presetThickness
presetFeather
resolution
amplitude
waveSpeed
flowX
flowY
distortStrength
distortScale
distortSpeed
damping
edgeAbsorb
restThreshold
stepsPerFrame
contrast
invert
```

Inspector visibility 负责根据 `sourceMode`、`presetKind`、`presetMode` 隐藏无关控件；Parameter Set 本身保持扁平。`initMap` 是 Asset Slot，不伪装成 Parameter。`resimulate` 是 Inspector Private Callback，不进入公开 Command map。`heightMap` 是 Visual Output ID。

不要为满足 computed coverage 人为增加无产品意义的 Shallow Water Parameter；computed scheduling 应先由 contract fixture 验证，只有出现真实派生值时再加入 Tool。

### 4.3 Main runtime state seam

当前 export callback 捕获 `ShallowWaterPreview.svelte` 内的 `previewRenderer`、`exportRenderer` 与 initial data。`outputs` named map 虽已确定，但实现前仍需冻结一个 Container-local runtime ownership interface，使 Canvas、private callback 与 Visual Output callback 能共享同一 Shallow Water runtime，而不依赖全局 singleton 或 runtime registration。

推荐下一轮设计比较：

1. `createRuntime(context)` factory 返回 Canvas model、callback handlers 与 Output handlers；
2. Tool-private ESM singleton；
3. Output callback 自己持有完全独立 renderer。

优先评估 `createRuntime`，因为它把每个 Session 的 state 与 dispose 集中在一个 deep module，最容易测试 Reload/Restart 资源释放。

## 5. 迁移顺序

### Slice 0：恢复可验证 baseline

- 按 ADR-0002 使用 Bun workspaces、`bun.lock` 与 `bun run` 作为 canonical repository workflow。
- 安装依赖后记录 `bun test`、production build 与 Shallow Water manual smoke baseline。
- 不在依赖缺失的环境中把 `ERR_MODULE_NOT_FOUND` 当作代码 regression。

### Slice 1：`tool-contract`

先实现纯 TypeScript types + runtime parsers：Manifest、Catalog identity、Parameter/Constraint、Asset Slot、Command、private callback、Visual Output、Inspector Tree、Environment envelopes。此 package 不 import Svelte、DOM、Electron 或 Vite。

先写 tests：

- `CatalogSourceRef + projectId` identity；
- map key 稳定 ID 与 duplicate/invalid Binding；
- Parameter dependency cycle、Constraint 与 unique Binding；
- Boot/Ready/message schema；
- stale Session rejection。

### Slice 2：`tool-sdk` declaration model

实现作者侧 inert `defineVisualTool`、Parameter/Asset/Command/private callback/Output definitions 与 descriptor-only Inspector builders。SDK 只构造 definition 与可观察的 Inspector AST，不扫描 Project、不执行 Tool Entry、不创建 extraction realm，也不生成 Catalog。typed handles 由 SDK declaration/builders 表达，但是否有效以及最终 descriptor 由 Builder 判定。

此阶段只用 fixture Tool 验证 declaration typing/building，不把测试称为 Forge extraction，也不碰 Workspace 和 Shallow Water。

### Slice 3：`tool-builder` extraction

- 复用文件遍历，不复用源码 regex。
- 使用 Forge-owned Vite/Svelte configuration 编译 Tool Entry 与 Surfaces。
- Builder 在可终止的独立 process/realm 中加载 definition、调用 `createInspector`、读取 SDK 产生的 Inspector AST、验证 named-map bindings 并生成 Catalog，设置 timeout。
- inline anonymous private callback 在这里成为 extraction failure。
- 同一 fixtures 生成 Web static Catalog 与 Desktop Project Catalog results。
- `.deshelf/` 只生成 IDE declarations/schema，并幂等维护 Tool Project `.gitignore`。

### Slice 4：`tool-host` pure core

先用 in-memory Catalog Source 和 fake Container adapter 开发：

- Session state machine；
- Parameter Store/revision/computed；
- Command/private callback single-flight；
- Asset/Output state；
- staged Reload replacement。

测试只跨 `tool-host` interface，不测试内部 reducer/state fields。

### Slice 5：Web iframe adapter

在现有 SvelteKit root 中先增加独立 tracer route/build flag，不立即搬迁整个应用到 `apps/web`。新 route 只能消费 generated Catalog，不能读取 `tool-registry.ts`。验证 Main boot/ready、Parameter change、Output、Asset 与 dispose 后，再切换根 Workspace。

### Slice 6：Desktop adapter

建立 Electron composition root、Open Project、Builder child process、AppData cache 与 WebContents/MessagePort。复用 Slice 4 的 Host core 和同一 transport conformance suite。

### Slice 7：Shallow Water 与 cutover

- 移动到 `tools/shallow-water/`，接入新 Manifest/Entry/Canvas。
- 对比 preview 与 deterministic exported frames。
- 根 Workspace 切到 Catalog-driven Host。
- 删除旧 registry/contexts/scaffold/Tool shell path，以及 `aspect-ratio`、`chromatic-aberration`、`hello-world`、`layout-smoke-test`、`noise-texture-creater`。
- 最后再决定是否把现有 SvelteKit root 物理移动到 `apps/web/`；不要让目录搬迁与 architecture cutover 发生在同一 diff。

## 6. Test migration

### 保留并提升

- `render-host/lifecycle-core.test.ts`：改为 Container lifecycle interface tests。
- `file-input/file-input.test.ts`：改为 Host Asset core 与 Web adapter tests。
- `canvas-export/canvas-export.test.ts`：保留 encoder/format tests，删除 context/registry tests。
- `preview-canvas/zoom.test.mjs` 与 footer tests：保留 Host Canvas slot behavior。
- `workspace-state.test.ts`：迁到 `catalogEntryId` 与 v2 persistence。
- Shallow Water 数值 normalization/determinism tests：保留。

### 新增

- Tool contract schema/conformance fixtures。
- extraction golden Catalog tests。
- named private callback mapping tests。
- Host Parameter/Command/Asset/Output/Reload tests。
- Web iframe 与 Desktop MessagePort 共用 transport conformance tests。
- Shallow Water Canvas Ready、Asset Input、deterministic PNG/video、Restart/Reload dispose smoke tests。

当前没有 iframe/Electron end-to-end harness；接入真实 adapters 时需要浏览器与 Electron smoke tooling，不能只靠 Node unit tests 宣称完成。

## 7. 当前 baseline

MAB-67 完成时：

- `bun test`：195 pass、0 fail，覆盖旧 production path 与新 contract/SDK/Builder packages。
- `bun run typecheck`：通过，包含 Tool SDK compile-time contract tests。
- `bun run build`：通过；保留现有文档编译与 chunk-size warnings。
- OpenSpec strict validation 与 `git diff --check`：通过。

## 8. 仍需冻结的 implementation decisions

1. **Container-local runtime ownership**：Canvas、private callbacks、Commands 与 Outputs 如何共享每 Session state；推荐 `createRuntime(context)` factory。
2. **Asset payload lifecycle**：Web Blob 与 Desktop opaque content 如何进入 Main、何处创建/释放 Container-local object URL。
3. **Visual Output execution**：encoding 在 Main 还是 application adapter；建议渲染/编码在 Main，Host adapter只负责用户确认和交付 encoded Blob/stream。

这三项属于 MAB-66 Host Session contract 与 MAB-70 Shallow Water migration 的前置设计，进入对应 `/implement` 前必须冻结；MAB-67 的 source-neutral Builder seam 已完成。
