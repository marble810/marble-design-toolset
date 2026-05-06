## Why

当前 Marble Design Toolset 已经具备 tool registry、ToolShell、PreviewCanvas、file-input 与 canvas-export 等基础能力，但 framework 与 tools 之间的契约仍偏薄：许多通用流程只抽到了底层 runtime，带 UI 的工作流、渲染生命周期和导出协调仍由各 tool 分散实现。

随着 Pixi、Three、文件输入、视频/图片导出类工具增多，这会放大重复代码、文档漂移、生命周期遗漏和扩展成本；需要把现有零散抽象收束成更稳定的 framework-owned Tool API。

## What Changes

- 强化 tool runtime contract：为 tool 会话提供稳定的 `toolId`、metadata、menu action dispatch、session active 状态和声明能力读取方式。
- 增加 tool contract 校验：在测试或脚本层校验目录 schema、metadata 字段、root-level master 组件、`techStack` 声明和 export 声明/注册一致性。
- 新增 tool-facing IO 模块：从工具调用层统一文件来源、picker/drop、Source UI 绑定、文件摘要、错误状态、临时资源清理和下载 primitive，减少 tool 侧 glue code。
- 将常见参数工作流抽成共享组件：field wrapper、select field、checkbox field、segmented control、preset grid、field hint/error 等。
- 改进 canvas export runtime：支持多 exporter 的选择/命名、使用真实 `toolId` 生成默认文件名、显示 metadata/exporter mismatch 诊断，并为导出任务提供更清晰的状态语义。
- 为 Pixi、Three、Canvas2D 类工具增加 session-aware render host lifecycle helper，统一初始化、resize、pause/resume、dispose 与 exporter 注册模式。
- 拆分工作区入口内部职责，把 `+page.svelte` 中的 tab、hash、localStorage、settings、catalog 操作沉淀到 workspace controller/组件边界中，保持外部行为不变。
- 对脚手架和文档进行对齐，避免继续生成或展示与 framework-owned export、共享 input/runtime 方向冲突的旧模式。

## Capabilities

### New Capabilities

- `tool-workflow-ui`: 定义 tool 左侧面板中可复用的 workflow UI，包括 Source input、drop zone、field wrapper、select/checkbox/segmented control、preset grid 与错误/提示展示。
- `tool-io`: 定义 tool 调用层的一体化 IO 模块，包括文件来源 controller facade、SourceInputSection/DropZone 绑定、文件摘要、错误展示、object URL 生命周期和下载 primitive。
- `tool-workflow-ui`: 定义 tool 左侧面板中可复用的参数 workflow UI，包括 field wrapper、select/checkbox/segmented control、preset grid 与错误/提示展示。
- `render-host-lifecycle`: 定义 Pixi、Three、Canvas2D 等渲染 host 的 session-aware 生命周期 helper，覆盖初始化、暂停/恢复、resize、销毁和 exporter 注册协作。

### Modified Capabilities

- `tool-module-runtime`: 强化 tool definition、runtime context、menu action dispatch、目录 schema 与 contract validation 要求。
- `tool-canvas-export`: 扩展 exporter 选择、默认文件名、声明/注册 mismatch 诊断和导出任务状态要求。
- `tool-scaffolding`: 更新脚手架输出，使生成模板使用新的共享 workflow UI 与 render host lifecycle 模式。

## Impact

- 影响 framework runtime：`src/lib/runtime/tool-registry.ts`、`src/lib/runtime/tool-shell-context.ts`、`src/lib/runtime/tool-session-context.ts`、`src/lib/runtime/tech-stack.ts`、`src/lib/runtime/canvas-export/`。
- 影响 tool-facing IO：现有 `src/lib/runtime/file-input/`、未来 `src/lib/runtime/io/` 或等价 facade，以及对应 source/drop UI 组件。
- 影响 shell/UI：`src/routes/+page.svelte`、`src/lib/components/shell/`、`src/lib/components/ui/`。
- 影响 tools：优先迁移 `chromatic-aberration`、`noise-texture-creater`、`shallow-water-height`、`aspect-ratio` 中重复的 source input、field、preset、render lifecycle 和 export 注册代码。
- 影响脚手架与文档：`scripts/tool-scaffold/`、`docs/guides/Making Tools/`。
- 不引入新的重型通用依赖；仍遵守当前仅声明并通过共享 runtime 加载 `three`、`pixi`、`gsap` 的约束。