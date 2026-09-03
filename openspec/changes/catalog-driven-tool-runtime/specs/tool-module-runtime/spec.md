## MODIFIED Requirements

### Requirement: Tool Project 只使用一个 Manifest 与一个固定 Tool Entry
每个 Tool Project SHALL 包含一个根 `manifest.json`、一个根 `index.ts`，以及至少一个位于 `canvas/` 的 Canvas Svelte module。固定 Tool Entry SHALL 为 `./index.ts`；Manifest MUST NOT 声明 entry path。可选 implementation files 与 directories MUST NOT 创建第二个 registration point。

#### Scenario: 作者创建最小 Tool Project
- **WHEN** 作者创建一个 Visual Tool
- **THEN** Project root 包含 `manifest.json`、`tsconfig.json`、`index.ts` 与 `canvas/Canvas.svelte`
- **THEN** `index.ts` default-export 一个 `defineVisualTool` definition

#### Scenario: 作者增加 Tool Slate
- **WHEN** Visual Tool 需要 Tool-owned secondary DOM Surface
- **THEN** Tool Entry 动态 import Slate Svelte module
- **THEN** 不创建第二个 Manifest 或 Tool Entry

### Requirement: Tool Manifest 只包含静态 identity 与 Forge environment
Tool Manifest SHALL 包含 contractVersion、Project ID、slug、name、version、Forge Profile 与已声明 Framework Libraries。它 MUST NOT 包含 Parameter、Command、Inspector、Capability、Slate、Export 或 enabled runtime definitions。

#### Scenario: Forge 发现 Manifest
- **WHEN** 根 `manifest.json` 包含有效 Deshelf identity 与 Forge fields
- **THEN** Forge 把该 Folder 视为 candidate Tool Project

#### Scenario: Forge 遇到无关 Manifest
- **WHEN** `manifest.json` 缺少 Deshelf identity fields
- **THEN** Forge 把它作为非 Deshelf Manifest 忽略

### Requirement: Tool Entry module 顶层无副作用
Tool Entry SHALL 使用一个 default `defineVisualTool` definition，动态 import Canvas 与可选 Slate，并避免顶层 DOM、timer、GPU 或 listener side effects。

#### Scenario: Forge 为 extraction 执行 Tool Entry
- **WHEN** Tool Entry 在 extraction realm 中加载
- **THEN** 加载过程不 mount UI、不创建 GPU resources，也不启动 loops
- **THEN** Forge 能够确定性抽取 descriptors

### Requirement: Framework Libraries 由 Forge Profile 供给
Visual Tool SHALL 只在 Manifest 声明受支持的 Framework Libraries，并 SHALL 在 Tool Container 内获得这些 libraries。Tool Project MUST NOT 提供自己的 node_modules、third-party package 或 custom Vite/Svelte configuration。

#### Scenario: Tool 声明 Three
- **WHEN** Manifest 列出 `three`
- **THEN** Forge 编译并向 Main Container 供给 Forge Profile 版本
- **THEN** Tool 不安装另一份 Three
