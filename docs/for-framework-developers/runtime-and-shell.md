# Runtime 与 Shell 架构

## 概览

Marble Design Toolset 的 runtime 层分为两个部分：

- **Shell**：Workspace 级别的布局与路由（`src/lib/components/shell/`、`src/routes/`）
- **Runtime**：框架级 capability 实现（`src/lib/runtime/`）

Tool 只通过 public SDK 访问 runtime 能力；shell 组件则同时被 framework 和 tool 使用（布局组件为 public）。

## Shell 结构

```
src/lib/components/shell/
├── index.ts                    ← public export（LeftPanel、RightPanel、Section 等）
├── layout/
│   ├── LeftPanel.svelte
│   ├── RightPanel.svelte
│   ├── Section.svelte
│   ├── PreviewCanvas.svelte
│   └── FullStage.svelte
├── workspace/
│   ├── WorkspaceShell.svelte   ← 顶层 workspace，管理 tool 路由
│   └── ToolShell.svelte        ← 单个 tool 的宿主容器
└── tool-session/
    └── ToolSession.svelte      ← internal — session active / lifecycle 协调
```

**布局规则：**
- Workspace shell 拥有顶层布局。
- Tool 只能渲染自己的 `LeftPanel` 和 `RightPanel`/`FullStage`/`PreviewCanvas` 内容。
- Tool **不能**重新定义 workspace shell 的顶层布局。

## Tool 加载

Tool 通过懒加载 Svelte 组件的方式被 framework 加载：

```
src/lib/runtime/tool-registry/
```

每个 tool 的 `index.ts` 导出一个 `ToolDefinition`，包含：
- `metadata`：来自 `metadata.json` 的静态信息
- `techStack`（可选）：声明需要的 heavy tech stack
- `loadComponent`：懒加载 master `.svelte` 的动态 import

Framework 在渲染时：
1. 解析 `techStack` 声明，通过 shared runtime 加载对应依赖（Three.js / Pixi.js / GSAP）
2. 调用 `loadComponent()` 懒加载 tool 组件
3. 把 tool 组件渲染到 `ToolShell` 提供的容器中

## Runtime 能力模块

```
src/lib/runtime/
├── file-input/          ← 底层文件选择、拖放、读取、对象 URL 管理
├── io/                  ← tool-facing IO facade（createToolSourceInput 的实现层）
├── canvas-export/       ← export context、exporter registry、PNG/视频编码
├── render-host/         ← host lifecycle、Pixi/Three/Canvas2D render host
├── tech-stack/          ← tech stack 加载与 capability 声明
├── tool-registry/       ← tool 发现与注册
└── tool-session-context.ts  ← session active 状态的 Svelte context key
```

这些模块是 **internal**，framework 可以随时重构。Tool 通过 `$lib/tool-sdk/index.js` 访问对应能力的 public wrapper。

## IO Pipeline

```
src/lib/runtime/file-input/     ← primitive（picker、drop listener、file reader、URL 清理）
     ↓ wraps
src/lib/runtime/io/             ← tool-facing facade（createToolSourceInput）
     ↓ re-exports via
src/lib/tool-sdk/index.ts       ← public surface
```

底层 file-input primitive 负责：
- `createFileInputController`：文件选择 controller
- `extractDroppedFiles`：拖放事件解析
- `readFileInputItem`：文件读取（ArrayBuffer、DataURL、text）
- 对象 URL 的创建和清理

IO facade（`src/lib/runtime/io/`）在此基础上：
- 统一 picker、drop、drag-over 状态
- 统一错误和 busy 状态
- 统一对象 URL 生命周期

Tool 不应直接操作 file-input primitive，优先使用 `createToolSourceInput`。只有 facade 无法表达的特殊流程才使用 public SDK 暴露的 escape hatch。

## Export Runtime

```
src/lib/runtime/canvas-export/
├── context.ts     ← ExportContext Svelte context（ToolShell setContext / tool getContext）
├── index.ts       ← public re-export（via tool-sdk）
└── canvas-export.test.ts
```

Export 流程：
1. `ToolShell` 在渲染时 `setContext(CANVAS_EXPORT_KEY, { exporters, register })`
2. Tool 的 preview 子组件在 `onMount` / 生命周期中调用 `getCanvasExportContext().register(descriptor)` 注册 exporter
3. Framework 的 Export Section（LeftPanel 底部）读取注册的 exporters，驱动编码和下载

## Host Lifecycle

```
src/lib/runtime/render-host/
├── lifecycle-core.ts           ← 纯逻辑（testable，不依赖 Svelte）
├── lifecycle.svelte.ts         ← Svelte 响应式 lifecycle wrapper
├── host-lifecycle.svelte.ts    ← createToolHostLifecycle（统一 init/active/cleanup/export）
├── index.ts                    ← Pixi/Three/Canvas2D render host helpers
└── lifecycle-core.test.ts
```

Host lifecycle 协调：
- `runInit(cb)`：异步初始化（WebGL context、Pixi Application、Three renderer）
- `isSessionActive`：workspace tab active/inactive 状态
- `startAnimationLoop(cb)`：只在 active 时运行帧回调，inactive 时自动暂停
- `addCleanup(cb)`：组件销毁时统一清理
- `registerCanvasExporter(...)`：lifecycle-aware 的 exporter 注册（组件销毁时自动注销）

## 添加新 Runtime Capability

1. 在 `src/lib/runtime/<capability>/` 下创建 capability 目录。
2. 把纯逻辑拆进 `<capability>-core.ts`（testable，不依赖 Svelte）。
3. 用 `<capability>.svelte.ts` 包裹 Svelte 响应式层（若需要）。
4. 写 `<capability>.test.ts`，覆盖核心逻辑。
5. 在 `src/lib/tool-sdk/index.ts` 决定暴露哪些 public wrapper。
6. 在 `docs/for-tool-developers/` 补充 tool 使用文档。
