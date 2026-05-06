## Context

当前工作区已经形成基本的 framework-owned shell：`src/routes/+page.svelte` 负责 catalog、tabs、hash、本地持久化和 settings；`ToolSession` 负责 definition、tech stack 与组件加载；`ToolShell` 提供左右布局与 canvas export context；tools 在 `LeftPanel` 与 `RightPanel` 内组合自己的控制区和预览区。

问题不在于缺少基础设施，而在于基础设施停在较低层。file-input 已统一读取和对象 URL 清理，但 Source section、drop zone、错误展示仍在工具内重复；canvas-export 已统一编码和下载，但 exporter 选择、真实 tool id 文件名、声明/注册 mismatch 仍不完整；Pixi/Three 初始化、暂停恢复、销毁和 exporter 注册仍由工具各自手写。

目标架构应保留现有 tool schema 和懒加载模型，同时把 framework 与 tools 的边界提升为稳定的 Tool API：framework 拥有 shell、tool-facing IO、workflow UI、runtime services、export UI 和通用渲染生命周期；tool 保留领域状态、算法、shader、场景和参数含义。

```text
Workspace Shell
  └─ WorkspaceController: tabs / hash / persistence / settings
      └─ ToolSession: definition / tech stacks / component load / runtime context
          └─ ToolShell: layout / export registry / shell context
              ├─ LeftPanel: MainInfo / tool sections / shared workflow UI / ExportSection
              └─ RightPanel: PreviewCanvas / FullStage / custom content

Tool code
  ├─ domain state + algorithms
  ├─ tool-facing IO facade
  ├─ shared workflow UI composition
  └─ render host helper + exporter descriptor
```

## Goals / Non-Goals

**Goals:**

- 让 tool 作者少写重复 glue code，优先复用 framework-owned workflow UI、render lifecycle 和 export runtime。
- 让 tool 作者通过一体化 tool IO facade 调用文件来源、drop、source UI、摘要、错误和清理能力，而不是在每个 tool 中重复拼装这些导入和处理器。
- 明确 tool contract：tool id、metadata、menu actions、session active、声明技术栈和 export capability 都通过稳定 runtime context 暴露。
- 提高架构可验证性：目录 schema、metadata、definition、tech stack、export 声明和 exporter 注册模式能够被测试或脚本发现问题。
- 在不改变用户可见工作区行为的前提下拆薄 `+page.svelte`。
- 让脚手架、docs 和现有工具迁移到同一套 framework/tool 边界语言。

**Non-Goals:**

- 不重写所有工具的领域算法、shader、simulation 或视觉设计。
- 不引入 `three`、`pixi`、`gsap` 之外的新重型通用依赖。
- 不把所有工具表单改造成 schema-driven 自动生成 UI；工具仍手动组合共享组件。
- 不改变当前纯横屏、英文共享 UI 文案、CSS Custom Properties 和 px 单位约束。

## Decisions

### 1. 采用增量分层，而不是推倒重建

继续保留 `src/tools/<tool-id>/index.ts`、`metadata.json`、root-level master `.svelte` 和 private `components/` 目录。新增能力通过 context、组件和测试补强，而不是改成插件包系统。

替代方案是引入完整 plugin manifest 或配置驱动渲染，但当前工具数量较少、领域差异大，过早收敛会压扁工具表达能力。

### 2. Tool runtime context 成为 framework/tool 主契约

`ToolSession` 应在加载 definition 后建立包含 `toolId`、metadata、menu actions、session active、loaded tech stacks 和 menu dispatch 的 runtime context。`ToolShellContext` 可继续承载 MainInfo 所需数据，但不应成为所有 runtime 服务的混合容器。

替代方案是让每个工具继续从 registry、workspace 或 URL 推断身份；这会让导出文件名、菜单动作和诊断逻辑继续依赖脆弱的反推。

### 3. Tool IO 作为工具调用层 facade，而不是只做底层 file-input

新增 tool-facing IO 模块，用一个稳定入口组织文件来源 controller、picker/drop ingest、SourceInputSection 绑定、DropZone 绑定、文件摘要、错误状态、object URL 生命周期和下载 primitive。tool 侧应能通过少量 import 和一次 source workflow 创建，拿到 UI 与 runtime 都能消费的对象。

这层不取代现有 file-input pipeline；file-input 继续负责底层类型判定、读取、错误和资源回收。tool IO 是作者体验层，目的是减少 `createFileInputController`、`extractDroppedFiles`、手写 drag state、Source section UI 和 summary formatter 在每个工具里的重复。

Export pipeline 不整体并入 tool IO。`canvas-export` 可以复用 IO 的 download primitive，但仍保留自己的 frame source、编码、capability 和 job 状态，因为它的核心是 render/export pipeline，不只是文件 IO。

### 4. 共享 workflow UI 以组件形式提供

Field、SelectField、CheckboxField、SegmentedControl、PresetGrid 应作为可组合 UI 组件出现。文件来源相关 UI 则归入 tool IO，因为它需要与 file controller、drop ingest 和资源生命周期一起设计。工具传入 labels、selected value 和 callbacks，而不是提交一份表单 schema。

这样保留 Svelte 组合自由度，也让 `chromatic-aberration`、`shallow-water-height`、`aspect-ratio`、`noise-texture-creater` 的重复 UI 可逐步迁移。

### 5. Render host helper 只管理生命周期，不接管领域渲染

Pixi/Three/Canvas2D helper 负责加载技术栈、创建/销毁 host、响应 session active、处理 resize、提供 exporter 注册桥接；工具继续提供 shader、scene、simulation、frame render callback。

替代方案是把 Pixi/Three 封成大型框架组件，但这会把通用壳层与具体渲染库过深耦合，不符合可选技术栈按声明加载的约束。

### 6. Export runtime 继续 framework-owned，但补齐多 exporter 与诊断

Export Section 仍固定由 LeftPanel 注入。若当前 tool 注册多个 exporter，framework 提供 exporter selector；默认文件名使用 runtime context 的真实 `toolId`；metadata 声明与 runtime exporter capability 不匹配时显示稳定诊断。

### 7. Workspace 拆分保持行为等价

`+page.svelte` 应只组合 workspace shell，tab/hash/persistence/settings 操作下沉到 controller 和局部组件。拆分必须保持现有 hash restore、localStorage restore、keep-alive sessions 和 left panel width 行为不变。

## Risks / Trade-offs

- [Risk] 抽象过早导致工具表达受限 → Mitigation: tool IO、workflow UI 和 render host helper 均保持可选，工具可继续使用低层 runtime。
- [Risk] IO facade 变成“大杂烩” → Mitigation: 只纳入 tool-facing import/download/source 工作流；workspace persistence 和 canvas export pipeline 保持独立边界。
- [Risk] 迁移复杂工具时引入渲染回归 → Mitigation: 先迁移最小样本，再迁移 Pixi 静态、Pixi 文件输入、Three simulation 三类代表工具。
- [Risk] contract validation 与脚手架规则重复 → Mitigation: 复用同一套 schema/helper 或测试 fixture，避免规则写散。
- [Risk] Export 多 exporter UI 增加复杂度 → Mitigation: 单 exporter 时保持现有 UI；仅在多个 exporter 时显示 selector。
- [Risk] `+page.svelte` 拆分产生行为漂移 → Mitigation: 先补 workspace-state/controller 测试，再做行为等价提取。

## Migration Plan

1. 先补 contract validation 和 runtime context，保证后续组件可以读取真实 `toolId`、metadata、session active 和 menu dispatch。
2. 提取 tool IO facade，并迁移一个文件输入型工具验证一体化调用面。
3. 提取共享参数 workflow UI，并迁移一个表单型工具验证 API。
4. 改进 canvas export runtime，再迁移已有 exporter 注册点。
5. 增加 render host lifecycle helper，并迁移 Pixi/Three 代表工具。
6. 拆分 workspace controller，保持用户可见行为不变。
7. 更新脚手架和 docs，删除或改写旧的自定义下载示例。

## Open Questions

- 多 exporter descriptor 是否需要显式 `label` 字段，还是由 framework 生成默认 label 后允许可选覆盖？
- loaded tech stack modules 是否应直接注入 runtime context，还是仅提供 typed getter 以维持懒加载边界？
- render host helper 应优先做函数式 controller，还是 Svelte 组件/action 组合？