## ADDED Requirements

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
