## ADDED Requirements

### Requirement: Tool Container 通过 Boot 与 Surface Ready 启动
Deshelf Host SHALL 通过发送一个包含 protocol version、Session ID、endpoint role、Parameter snapshot 与 Surface dimensions 的 `boot` request 启动 Tool Container。Main Container SHALL 只在发出 Canvas `surface.ready` 后成为 Ready。启动 MUST NOT 要求 hello、welcome、Capability Grant 或 runtime Tool Registration。

#### Scenario: Main Container 成功启动
- **WHEN** Host 发送有效 Main boot request 且 Canvas 完成 mount
- **THEN** Main 发出 Canvas `surface.ready`
- **THEN** Host 把 Tool Session 标记为 Ready

#### Scenario: Tool 包含 Slate
- **WHEN** Catalog Entry 引用 Slate artifact
- **THEN** Host 启动独立 Slate Container
- **THEN** Slate readiness 不阻塞 Main Canvas Ready

### Requirement: Environment API 是共享管理 interface
Web 与 Desktop SHALL 对 Parameter、Command、Surface、Asset/Export adapter 与 diagnostic messages 使用相同 Environment API TypeScript union 和 runtime schemas。每个应用 MUST 提供自身 transport adapter，且不得复制 message semantics。

#### Scenario: Parameter 发生变化
- **WHEN** Host 提交一个 Parameter value
- **THEN** Main 在 Web 与 Desktop 收到相同的 `parameter.changed` semantic

#### Scenario: 旧 Session 发送消息
- **WHEN** message 携带 Restart 或 Reload 后不再 active 的 Session ID
- **THEN** Host 丢弃该 message，且不修改当前 Session state

### Requirement: 性能热路径留在 Tool Container
Environment API MUST NOT transport pointer events、animation-frame callbacks、Framework Library objects、simulation state 或 Canvas pixels。Standard Inspector SHALL 在发送 Parameter update 前合并本地 pointer changes。

#### Scenario: 用户拖动 Slider
- **WHEN** pointer movement 反复更新 Standard Control
- **THEN** Host 更新本地显示而不发送每个 pointer event
- **THEN** Host 只按 rAF 或 pointer completion 发送合并后的 Parameter updates

### Requirement: Envelope 与运行时 schema 确定消息合法性与会话归属
Environment API SHALL 使用单一 envelope 承载 protocolVersion、sessionId、kind（request/response/event）、name、可选 requestId 与 payload。每个 name+kind 组合 SHALL 有确定性运行时 validator；非法 envelope SHALL 产生 typed diagnostics 并被丢弃。`sessionId` SHALL 过滤 Restart/Reload 后不再 active 的消息，`requestId` 只用于 request/response 配对，MUST NOT 作为 per-message sequence。

#### Scenario: 非法 envelope 到达 Host
- **WHEN** Container 发送损坏的 envelope（未知 name、错误 payload 形状或 payload 类型不匹配）
- **THEN** Host 丢弃该消息并记录 `env/invalid` diagnostic
- **THEN** Session state 不变

#### Scenario: 旧 Session 消息在 Restart 后到达
- **WHEN** Restart/Reload 创建了新 sessionId，旧 Container 消息仍使用旧 sessionId
- **THEN** Host 丢弃该消息，且不修改当前 Session state

### Requirement: v1 消息族覆盖 parameter、command、surface、asset/export 与 diagnostic
v1 消息族 SHALL 包含 `boot`、`surface.ready | resize | dispose`、`parameter.snapshot | changed | set | compute`、`command.execute | cancel | result`、`asset.request | changed`、`export.execute | result` 与 `diagnostic.emit`。`parameter.set` SHALL 携带 `expectedRevision` 并在响应中以 typed rejection 或 accepted value+revision 返回。Asset/Export payload SHALL 只携带可序列化内容（Web 的 blob URL 或 Desktop 的 opaque handle）；真实文件系统路径 MUST NOT 跨 seam。

#### Scenario: Slate 修改 Parameter
- **WHEN** Tool Slate 通过 `parameter.set` 提交值且通过 Store validation
- **THEN** Host 以 `parameter.changed` 广播提交结果
- **WHEN** 提交违反 type/mode/Constraint/revision
- **THEN** Host 返回 typed rejection response，且不广播 `parameter.changed`

#### Scenario: Container 请求 Asset 内容
- **WHEN** Tool 通过 `asset.request` 请求当前选择的 asset
- **THEN** Host 通过环境 adapter 返回可用内容（environment 未供给时返回 `empty`）

### Requirement: Endpoint role 由 transport channel 决定
Endpoint role（main/slate）SHALL 由 transport channel 的归属决定，envelope 内不重复声明。`surface.ready` payload 中的 endpoint/surface SHALL 与 channel role 一致；不一致 SHALL 产生 `session/endpoint-mismatch` diagnostic 并被忽略。

#### Scenario: Slate channel 报告 canvas ready
- **WHEN** Slate Container 在自身 channel 上发送 endpoint=main、surface=canvas 的 ready
- **THEN** Host 记录 `session/endpoint-mismatch` diagnostic
- **THEN** Slate 不视为 ready，Main state 不受影响

### Requirement: Desktop 路径留在 Tool Container 外
Desktop Asset Input 与 Export adapters MUST NOT 向 Main 或 Slate Containers 暴露真实 filesystem paths。

#### Scenario: 用户选择 Desktop asset
- **WHEN** Desktop adapter 把选中 asset 返回 Tool Container
- **THEN** Tool 通过 environment adapter 收到可用内容
- **THEN** payload 不包含真实 filesystem path
