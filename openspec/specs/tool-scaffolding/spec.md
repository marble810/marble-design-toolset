# tool-scaffolding Specification

## Purpose
定义仓库内交互式 tool 脚手架的作者工作流契约，确保新工具骨架输出符合现有 tool module schema 与运行时约束。
## Requirements
### Requirement: 仓库提供交互式 tool 脚手架命令
仓库 SHALL 提供一个基于 Bun 的本地命令，用于通过交互式输入创建新的 tool 模块骨架。该命令 SHALL 以当前仓库为作用域，而不是生成独立项目。

#### Scenario: 开发者启动脚手架且未提供必要信息
- **WHEN** 开发者运行 tool 脚手架命令且缺少创建新工具所需的信息
- **THEN** 命令会提示输入至少包括 tool name、starter type 和 tech stack 选择在内的必要参数

### Requirement: 脚手架输出符合现有 tool module schema 的文件结构
脚手架 SHALL 在 `src/tools/<tool-id>/` 下生成符合当前运行时 contract 的文件结构，其中包含 `metadata.json`、`index.ts`、唯一的 root-level master Svelte 组件，以及位于 `components/` 目录中的私有子组件。

#### Scenario: 开发者输入新的工具名称
- **WHEN** 开发者输入 `Banner Maker` 作为工具名称并完成脚手架流程
- **THEN** 命令会生成 `src/tools/banner-maker/` 目录
- **THEN** 该目录包含 `metadata.json`、`index.ts` 和 `BannerMaker.svelte`
- **THEN** 任何额外的私有 Svelte 子组件都位于 `src/tools/banner-maker/components/` 下

### Requirement: 脚手架根据 starter 类型生成对应的右侧容器骨架
脚手架 SHALL 根据开发者选择的 starter 类型生成不同的右侧容器模板，并确保生成的 master 组件继续使用 framework-owned panel wrappers。

#### Scenario: 开发者选择 preview starter
- **WHEN** 开发者选择 preview starter 创建新工具
- **THEN** 生成的 master 组件使用 `LeftPanel`、`RightPanel` 和 `PreviewCanvas` 组织最小可运行预览骨架

#### Scenario: 开发者选择 stage starter
- **WHEN** 开发者选择 stage starter 创建新工具
- **THEN** 生成的 master 组件使用 `LeftPanel`、`RightPanel` 和 `FullStage` 组织最小可运行 stage 骨架

### Requirement: 脚手架将 tech stack 选择写入 runtime definition 而非 metadata
脚手架 SHALL 仅允许声明当前共享 runtime 支持的 tech stack key，并 SHALL 将选中的 tech stack 写入 `index.ts` 的 runtime definition；`metadata.json` 仍 SHALL 只包含静态元数据字段。

#### Scenario: 开发者选择 three 与 gsap
- **WHEN** 开发者在脚手架中选择 `three` 和 `gsap`
- **THEN** 生成的 `index.ts` 包含对应的 `techStack` 声明
- **THEN** 生成的 `metadata.json` 不包含 `techStack` 或其他 runtime 装配字段

#### Scenario: 开发者未选择任何 tech stack
- **WHEN** 开发者在脚手架中不选择任何 tech stack
- **THEN** 生成的 `index.ts` 不会为了空选择写入无意义的 `techStack` 字段

### Requirement: 脚手架拒绝覆盖已有工具目录
脚手架 SHALL 在写入文件前检查目标 `src/tools/<tool-id>/` 是否已存在；若已存在，命令 MUST 中止且不得覆盖或部分改写现有文件。

#### Scenario: 目标 tool-id 已存在
- **WHEN** 开发者尝试创建一个 tool-id 已存在的工具
- **THEN** 命令报出冲突并停止生成流程
- **THEN** 现有工具目录中的文件保持不变

### Requirement: 脚手架模板使用共享 workflow UI
Tool 脚手架 SHALL 在生成 preview 或 stage starter 时优先使用共享 workflow UI 组件组织常见字段、模式切换、预设和文件来源示例。脚手架 MUST NOT 复制已有共享组件可以覆盖的 field、preset、source input 或 drop zone 交互逻辑。

#### Scenario: 开发者生成 preview starter
- **WHEN** 开发者通过脚手架创建 preview starter
- **THEN** 生成的 master 组件继续使用 LeftPanel、RightPanel 和 PreviewCanvas，并在需要示范控件时使用共享 field UI

#### Scenario: 开发者生成文件输入示例 starter
- **WHEN** 脚手架提供或扩展到文件输入 starter
- **THEN** 生成代码使用共享 SourceInputSection 和 DropZone，而不是手写 picker/drop/error UI

### Requirement: 脚手架模板使用 render host lifecycle helper
当脚手架生成声明 `three`、`pixi` 或 `gsap` 的 starter 时，输出代码 SHALL 展示共享 tech stack runtime 与 render host lifecycle helper 的推荐集成方式。模板 MUST 保持技术栈声明只写入 `index.ts` 的 runtime definition。

#### Scenario: 开发者选择 Pixi starter
- **WHEN** 开发者创建声明 `pixi` 的 starter
- **THEN** 生成的子组件使用 render host lifecycle helper 初始化和清理 Pixi host

#### Scenario: 开发者选择 Three starter
- **WHEN** 开发者创建声明 `three` 的 starter
- **THEN** 生成的子组件使用 render host lifecycle helper 初始化和清理 Three host

#### Scenario: 开发者未选择技术栈
- **WHEN** 开发者创建不声明重型技术栈的 starter
- **THEN** 生成代码不导入或加载 `three`、`pixi`、`gsap`

### Requirement: 脚手架与作者文档保持 framework-owned export 一致
脚手架输出和 Making Tools 文档 SHALL 避免示范 tool 自行实现 PNG/MP4 编码、`toDataURL()` 下载或 `a.click()` 下载。需要导出时，文档和模板 MUST 引导 tool 通过 metadata export 声明与 canvas export runtime 注册 exporter。

#### Scenario: 文档展示 Pixi 或 Three 导出
- **WHEN** 作者阅读 Pixi 或 Three tool 指南中的导出示例
- **THEN** 示例使用 framework-owned canvas export runtime，而不是在 tool 内创建下载链接

#### Scenario: 脚手架生成可导出 starter
- **WHEN** 脚手架未来生成带 export 能力的 starter
- **THEN** metadata 包含 export 声明，预览子组件注册 exporter，且不包含自定义下载实现

### Requirement: 脚手架模板默认遵循 public host boundary
Tool 脚手架 SHALL 默认生成遵循 public host boundary 的模板。脚手架输出中的宿主能力导入 MUST 优先使用 public SDK、公开 capability 和推荐 extension point，而不是 internal runtime 模块路径。

#### Scenario: 作者生成新 tool starter
- **WHEN** 作者通过脚手架创建新的 tool
- **THEN** 模板中的 runtime、IO、export 和 lifecycle 相关导入默认指向 public host boundary

#### Scenario: Framework internal 结构演进
- **WHEN** framework internal runtime 模块发生重构但 public boundary 不变
- **THEN** 现有脚手架模板不需要因为 internal 路径变化而频繁改写

### Requirement: 脚手架为 boundary 规则提供最短上手路径
脚手架和作者文档 SHALL 把 public host boundary 作为作者接入 framework 的最短上手路径。脚手架 MUST NOT 通过示例代码鼓励作者直接依赖 internal 模块，即使这些 internal 模块在当前仓库内可见。

#### Scenario: 作者参考脚手架继续扩展功能
- **WHEN** 作者以脚手架输出为起点继续实现 tool
- **THEN** 其默认参考路径是 public boundary 和 capability，而不是 internal framework 结构

#### Scenario: 作者需要更深度的自定义
- **WHEN** 作者拥有超出默认模板的高级需求
- **THEN** 文档继续以 public boundary 为默认入口，只在明确说明为 internal / escape hatch 时才下探更深层实现

### Requirement: 脚手架允许作者按 recipe 选择起步形态
Tool 脚手架 SHALL 在现有 tool name、starter type 和 tech stack 选择之外，允许作者选择可选的 capability recipe。脚手架 MUST 使用 recipe 生成与该能力组合对应的最小可运行 wiring，同时继续保持输出结构符合现有 tool module schema。

#### Scenario: 作者选择基础 preview recipe
- **WHEN** 作者在脚手架中选择 preview-basic recipe
- **THEN** 生成的工具继续包含 `metadata.json`、`index.ts`、唯一 root-level master 组件和私有 `components/` 子组件，并提供最小可运行的 PreviewCanvas wiring

#### Scenario: 作者选择导出 recipe
- **WHEN** 作者在脚手架中选择 preview-export recipe
- **THEN** 生成代码使用 framework-owned export 入口完成能力声明和 exporter 注册，而不是手写下载逻辑

### Requirement: Recipe 输出优先复用 shared capability
脚手架在生成 recipe 模板时 MUST 优先复用 shared runtime、shared UI 和 public tool SDK。对于 source input、drop zone、render host lifecycle 和 export wiring，模板 MUST NOT 复制已有共享 capability 可以覆盖的胶水逻辑。

#### Scenario: 作者选择 source-preview recipe
- **WHEN** 脚手架生成带本地文件来源的 recipe
- **THEN** 生成代码复用 shared source workflow 与 DropZone / SourceInputSection，而不是手写第二套 picker/drop/error glue code

#### Scenario: 作者选择带技术栈的 recipe
- **WHEN** 脚手架生成带 `pixi` 或 `three` 的 recipe
- **THEN** 生成代码复用 shared render host lifecycle 和 tech stack runtime，而不是手写独立加载链路

### Requirement: Tool scaffolding provides a layout-template recipe
The tool scaffolding command SHALL provide a `layout-template` recipe for creating layout-template tools. The generated output MUST conform to the existing tool module schema and MUST not create a custom workspace shell.

#### Scenario: Developer selects layout-template recipe
- **WHEN** a developer runs the tool scaffolding command and selects `layout-template`
- **THEN** the command generates `src/tools/<tool-id>/metadata.json`, `index.ts`, one root-level PascalCase Svelte master component, and private child components under `components/`

#### Scenario: Generated layout tool uses framework shell components
- **WHEN** the layout-template recipe generates the master component
- **THEN** the generated component uses `LeftPanel`, `RightPanel`, and `PreviewCanvas` rather than redefining the top-level workspace shell

### Requirement: Layout-template recipe demonstrates the full layout controller workflow
The `layout-template` recipe SHALL generate a complete runnable example that wires dynamic canvas size, multiple source slots, Google Font loading, uploaded font input, and DOM PNG export through `createLayoutToolController`.

#### Scenario: Generated starter is opened in workspace
- **WHEN** the generated layout-template tool is opened
- **THEN** it renders editable controls, a DOM layout preview, and a registered PNG exporter through framework export UI

#### Scenario: Generated starter declares export metadata
- **WHEN** the layout-template recipe writes `metadata.json`
- **THEN** the metadata includes image export capability without embedding runtime-only controller or tech stack configuration

### Requirement: Layout-template recipe avoids heavy tech stack declarations
The `layout-template` recipe SHALL be based on Svelte and DOM rendering only. It MUST NOT declare `three`, `pixi`, or `gsap` unless the developer explicitly chooses an additional supported tech stack outside the default recipe.

#### Scenario: Developer accepts default layout-template recipe
- **WHEN** the developer creates a layout-template tool without extra tech stack selection
- **THEN** the generated `index.ts` does not include `techStack` for `three`, `pixi`, or `gsap`

### Requirement: Layout-template documentation is generated or linked for tool authors
The scaffolding workflow SHALL direct tool authors to the layout-tool documentation under `docs/for-tool-developers/`. Generated code MAY include concise comments only where needed, but MUST NOT rely on comments as the primary documentation.

#### Scenario: Developer creates a layout-template starter
- **WHEN** the scaffolding command completes successfully
- **THEN** the command output or generated README guidance points the developer to the layout-tool documentation in `docs/for-tool-developers/`

