## ADDED Requirements

### Requirement: Forge 在构建期生成 Catalog Entry
Deshelf Forge SHALL 读取 Tool Project 根 Manifest 与固定 Tool Entry，编译 Tool Entry，抽取可序列化的 Parameter、Asset Slot、Command、private callback、Visual Output、Inspector Tree 与 Surface descriptors，并生成引用可运行 artifacts 的 Catalog Entry。Catalog Entry MUST NOT 包含函数、DOM nodes、Svelte components 或 Framework Library objects。

#### Scenario: 构建有效 Tool Project
- **WHEN** Manifest validation、Tool Entry compilation 与 descriptor extraction 全部成功
- **THEN** Forge 为该 Tool Project source upsert 一条可用 Catalog Entry
- **THEN** Catalog Entry 引用 Main artifact 与可选 Slate artifact

#### Scenario: Extraction 失败
- **WHEN** Tool Entry compilation、`createInspector` extraction 或 contract validation 失败
- **THEN** Forge 产生 diagnostics
- **THEN** 失败结果不成为可用 Catalog Entry
- **THEN** Deshelf Host 不从该失败结果启动 Tool Session

### Requirement: Catalog Source identity 与 Project ID 分离
Catalog SHALL 保留 Project ID 作为逻辑 Tool Project identity，同时使用 Catalog Source 与 Project ID 派生 Host-local Catalog Entry ID。具有相同 Project ID 的多个 Project Locations MUST NOT 互相覆盖。

#### Scenario: 两个 Location 包含相同 Project ID
- **WHEN** 两个 Project Locations 都可由 Catalog Source 使用
- **THEN** 每个 Location 获得不同 Catalog Entry ID
- **THEN** Reload 其中一个 source 只更新自身 Catalog Entry

### Requirement: Web 与 Desktop 暴露相同 Catalog Entry interface
Deshelf Web SHALL 在应用构建时生成 static Catalog。Deshelf Desktop SHALL 在 Open Project 构建成功后更新 Project Catalog。两种 sources MUST 向 Deshelf Host 暴露相同 Catalog Entry fields。

#### Scenario: Host 从任一应用打开 Tool
- **WHEN** 选中的 Catalog Entry 来自 Web 或 Desktop
- **THEN** Host 通过相同 interface 创建 Parameter Store 与 Standard Inspector
- **THEN** source-specific behavior 保持在 Tool Source adapter 后
