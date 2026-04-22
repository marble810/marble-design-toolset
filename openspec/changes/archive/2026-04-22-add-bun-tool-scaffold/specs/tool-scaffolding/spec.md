## ADDED Requirements

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