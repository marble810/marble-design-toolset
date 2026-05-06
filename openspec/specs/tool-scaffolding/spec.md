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
