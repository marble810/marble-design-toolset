## MODIFIED Requirements

### Requirement: Host 拥有 Workspace、Parameter Store 与 Standard Inspector
Deshelf Host SHALL 拥有顶层 Workspace、Tool Session lifecycle、authoritative Parameter Store、Standard Inspector、Environment Inventory 与 diagnostics。Visual Tool MUST NOT 渲染 Host layout panels 或持有 duplicate Parameter Store。

#### Scenario: Host 打开 Catalog Entry
- **WHEN** 用户打开一个有效 Visual Tool
- **THEN** Host 在 Main Container Ready 前创建 Parameter Store 与 Standard Inspector
- **THEN** Tool 只渲染 Canvas 与可选 Tool Slate Surfaces

### Requirement: Tool 拥有 simulation 与 Tool Surfaces
Visual Tool SHALL 在 Tool Containers 内拥有 simulation、renderer、Canvas 与可选 Tool Slate implementation。Main 与 Slate Containers MUST NOT 接收 Host DOM、Host Svelte context 或 Workspace components。

#### Scenario: Tool Slate 完成 mount
- **WHEN** Catalog Entry 包含 Slate artifact
- **THEN** Slate 在独立 Container 中拥有自身 DOM、Svelte、CSS 与 local state
- **THEN** Slate 不能修改 Host Inspector Tree

### Requirement: Tool Container 提供环境隔离而不是恶意代码安全
Web SHALL 使用 same-origin iframe Tool Container，Desktop SHALL 使用 WebContents 与 MessagePort。Framework MUST 说明 Web 可能与 Host 共用 renderer process，因此不保证 malicious-code 或 dead-loop isolation。

#### Scenario: Web Tool 进入死循环
- **WHEN** Main Container 阻塞共享 renderer
- **THEN** architecture 不宣称 Host 仍可响应
- **THEN** framework diagnostics 与文档保留该限制

### Requirement: Environment API 替代 runtime capability negotiation
Host 与 Tool Container SHALL 通过共享 Environment API 通信，不使用 Capability Declaration、Capability Grant、Capability Broker、runtime Registration 或 per-message ACL。

#### Scenario: Desktop Tool 需要 Asset Input
- **WHEN** 当前 Environment Inventory 包含 Asset adapter
- **THEN** Tool 通过 Environment API 使用该 adapter
- **THEN** Tool 不请求 runtime Capability Grant
