## MODIFIED Requirements

### Requirement: Tool SDK 暴露一个 defineVisualTool interface
Tool SDK SHALL 暴露一个 inert `defineVisualTool` declaration interface，用于 Parameter definitions、typed Asset Slot definitions、public Tool Commands、named private Inspector callbacks、Visual Output definitions、Inspector construction、Canvas dynamic import、optional Slate dynamic import 与 optional dispose。它 MUST NOT 扫描 Project、创建 extraction realm、执行 Tool Entry、生成 Catalog，也 MUST NOT 要求 runtime register 或 unregister calls；这些 extraction orchestration responsibilities 属于 Deshelf Forge 的 `tool-builder`。

#### Scenario: Tool 作者定义 Visual Tool
- **WHEN** `index.ts` default-export `defineVisualTool(...)`
- **THEN** Forge 能在构建期抽取可序列化 descriptors
- **THEN** Main artifact 保留 runtime callbacks 与 dispose implementation

### Requirement: Inspector Private Callback 使用 Tool Entry map key 作为稳定 ID
Tool SDK SHALL 要求 private Inspector callbacks 声明在扁平 `privateCallbacks` map 中。每个 map key SHALL 是稳定 callback ID，`createInspector` SHALL 接收从该 map 派生的 typed handles。作者 MUST NOT 在 callback definition 内重复填写 ID，也不得绑定 inline anonymous callback。

#### Scenario: 作者绑定 private callback
- **WHEN** Tool Entry 声明 `privateCallbacks.resimulate`，且 Inspector Button 绑定其 handle
- **THEN** Catalog 保存 `callbackId: 'resimulate'`
- **THEN** Main artifact 在相同 key 下保留 callback function

#### Scenario: Inspector 绑定未声明 callback
- **WHEN** extraction 遇到 inline callback 或不存在于 `privateCallbacks` 的 ID
- **THEN** Forge 拒绝 extraction 并产生 diagnostic

### Requirement: Asset Slot 与 Visual Output 声明在 Tool Entry maps
Tool SDK SHALL 暴露扁平 `assets` 与 `outputs` maps，其 keys 为稳定 IDs。Forge SHALL 把可序列化 descriptors 抽入 Catalog，并把 Visual Output callbacks 保留在 Main artifact。Canvas MUST NOT 在 mount 后注册 exporter。

#### Scenario: Tool 声明 image input 与 deterministic output
- **WHEN** Tool Entry 声明 image Asset Slot 与 render Visual Output
- **THEN** Host 能根据 Catalog descriptors 渲染 Asset Input 与 Export UI
- **THEN** runtime selection 与 rendering 通过 Environment API 和 Main artifact callbacks 执行

### Requirement: Inspector SDK 产生 descriptor 而不是 Host DOM
Inspector Element builders SHALL 产生 retained Inspector Tree，Forge 可以把它序列化进 Catalog Entry。Tool Session MUST 通过 Host Standard Controls 渲染该 Tree，且不得执行 `createInspector` 获取第二棵 runtime Tree。

#### Scenario: 作者绑定 Slider
- **WHEN** `createInspector` 把 Slider 绑定到一个 Tool Parameter
- **THEN** extraction 记录可序列化的唯一 Parameter Binding
- **THEN** Host 在不向 Tool 提供 Host DOM 的前提下渲染 Slider

### Requirement: Tool SDK 隐藏 Environment transport adapters
Tool SDK SHALL 提供 Container-side Environment client，用于 Parameter、Asset、Export 与 diagnostics operations，同时隐藏 iframe MessagePort、Desktop MessagePort、postMessage 与 ipcRenderer details。

#### Scenario: Tool 使用 Asset Input
- **WHEN** Tool 调用 SDK Asset interface
- **THEN** Environment client 使用当前应用 adapter
- **THEN** Web 与 Desktop 中的 Tool code 保持一致

### Requirement: SDK types 在本地供给且不发布 npm
Deshelf Desktop SHALL 生成 `.deshelf` TypeScript 与 Svelte declarations，以及 Tool SDK/Framework Libraries 的 Project tsconfig aliases。Tool Project MUST NOT 从 npm 安装 Deshelf SDK。

#### Scenario: 作者在 editor 打开 Tool Project
- **WHEN** `.deshelf` generation 成功且 Project tsconfig extends generated config
- **THEN** VS Code 或 Zed 能解析 `@deshelf/*` types
- **THEN** Forge Builder 在构建时解析相同 aliases
