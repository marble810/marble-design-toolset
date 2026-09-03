## MODIFIED Requirements

### Requirement: Tool Session 使用 Catalog-driven lifecycle states
Tool Session SHALL 依次经过 Cataloged、HostReady、Booting、Ready 或 Failed，以及 Closed states。HostReady MUST 表示 Parameter Store 与 Standard Inspector 已在 Main Container boot 前存在。Canvas `surface.ready` SHALL 触发 Booting 到 Ready 的 transition。

#### Scenario: Tool 成功打开
- **WHEN** Host 打开一个有效 Catalog Entry
- **THEN** Host 创建 Store 与 Inspector 并进入 HostReady
- **THEN** Host boot Main Container
- **THEN** Canvas `surface.ready` 使 Session 进入 Ready

#### Scenario: Tool startup 失败
- **WHEN** artifact loading、version validation、Entry execution 或 startup timeout 失败
- **THEN** Session 进入 Failed 并保留 diagnostics
- **THEN** Host 不自动销毁 Container
- **THEN** Host chrome 提供 Restart Tool

### Requirement: Host 仅凭 Catalog Entry 建立 Store 与 Inspector
Parameter Store SHALL 只由 Catalog Entry 的 Parameter descriptors 构建，并执行 type、mode、Constraint 与 per-parameter revision 校验；computed 参数 MUST NOT 被直接 set。Standard Inspector SHALL 渲染 Catalog Entry 的 `inspectorTree`；Entry 无 `createInspector` 输出时 SHALL 按 Parameter descriptors 生成默认树，computed 控件 SHALL 显示为 disabled。

#### Scenario: Host 打开无自定义 Inspector 的 Tool
- **WHEN** Catalog Entry 的 inspectorTree 为空且存在 Parameter descriptors
- **THEN** Host 按 descriptors 生成默认控件树
- **THEN** computed 参数以 disabled 控件展示且不可 set

#### Scenario: 携带 stale revision 的写入
- **WHEN** `parameter.set` 的 `expectedRevision` 不等于 Store 当前 per-parameter revision
- **THEN** 写入被 typed rejection（`parameter/revision`）拒绝

### Requirement: Ready 前 Store 可更新，ready 后补发最新 snapshot
Host Store SHALL 在 HostReady/Booting 期间接受 Host 侧更新；收到 Canvas `surface.ready` 时 Host SHALL 以 `parameter.snapshot` 补发包含最新值的完整 snapshot。

#### Scenario: Inspector 在 boot 完成前修改参数
- **WHEN** 用户在 Booting 阶段调整控件并 flush
- **THEN** Store 记录该更新
- **THEN** `surface.ready` 后发送的 snapshot 包含该最新值

### Requirement: Parameter 更新被合并，computed 由 Host 调度
Standard Controls SHALL 在本地合并 pointer 输入（`parameter.set` 只在 rAF 或 pointer completion 时发送一次）；Host Store SHALL 按依赖拓扑分 wave 串行调度 computed 计算，in-flight 期间的新提交 SHALL 标记依赖为 dirty 并在响应后重算。非法 computed 结果 SHALL 保留最后合法值并产生 `parameter/compute-invalid` diagnostic；executor 超时/失败 SHALL 产生 `parameter/compute-timeout` diagnostic 并保留现有值。

#### Scenario: 拖动 Slider 后带出 computed 重算
- **WHEN** 用户拖动 Slider 且目标参数被 computed 依赖
- **THEN** Host 在 flush 后发送一次 `parameter.set` 并广播一次 `parameter.changed`
- **THEN** Host 向 Main 发送按拓扑排序的 `parameter.compute` wave
- **THEN** 响应提交后，下一 wave 才发送

#### Scenario: computed 返回非法值
- **WHEN** Container 返回超出 Constraint 的 computed 结果
- **THEN** Store 保留最后合法值并产生 `parameter/compute-invalid` diagnostic

### Requirement: Tool Command timeout 影响 Session health
Ready Session SHALL 跟踪 Responsive 或 Unresponsive health。Tool Command SHALL single-flight，并使用 Deshelf Runtime Config timeout。若 callback 在 cancel 后仍未结束，Host SHALL 把 Session health 标记为 Unresponsive，并提供 Restart Tool，且不自动关闭 Container。Inspector private callback SHALL 使用相同执行机制但不进入公开 Tool Command map。

#### Scenario: Command 在 timeout 后不停止
- **WHEN** Host 发送 cancel 且 callback 仍处于 active
- **THEN** Session health 变为 Unresponsive
- **THEN** 对应 Host controls 保持 unavailable
- **THEN** 用户可以选择 Restart Tool

#### Scenario: Command 在 cancel grace 内完成
- **WHEN** timeout 后 Host 发送 cancel，且 callback 在 cancel grace window 内返回
- **THEN** Command 以 completed/failed 收尾
- **THEN** Session health 保持 Responsive

### Requirement: Restart 与 Reset Defaults 不重新构建
Restart Tool SHALL 使用当前 Catalog Entry/artifact 创建新 Session ID、新 Store（默认值）与新 Container，可从 Ready（含 Unresponsive）或 Failed 发起；旧 Container 只收到 best-effort `surface.dispose`。Reset Defaults SHALL 仅恢复 manual/overrideable 默认值并重算 computed，不更换 Container。

#### Scenario: Unresponsive 后 Restart
- **WHEN** Session health 为 Unresponsive 且用户选择 Restart Tool
- **THEN** Host 以新 sessionId boot 新 Container
- **THEN** 新 Canvas ready 后 Session 回到 Ready + Responsive

#### Scenario: Reset Defaults
- **WHEN** 用户选择 Reset Defaults
- **THEN** 仅 manual/overrideable 参数恢复默认值并广播 `parameter.changed`
- **THEN** computed 参数按新依赖重算
- **THEN** Container 不被替换

### Requirement: Reload 使用一个 staged replacement
Reload Tool SHALL 构建并抽取新的 Catalog Entry，计算 staged compatible Parameter 与 Asset state，并使用 staged snapshot boot 最多一个 replacement Main Container。Host SHALL 只在 replacement Canvas Ready 后 commit 并切换。失败 MUST 保留旧 Session。

#### Scenario: Replacement 到达 Ready
- **WHEN** replacement Canvas 发出 `surface.ready`
- **THEN** Host 原子提交 staged state 并切换 active Session
- **THEN** Host dispose 旧 Container

#### Scenario: Replacement 失败
- **WHEN** replacement build、boot 或 readiness 失败
- **THEN** Host 释放 staged resources
- **THEN** 旧 Session 保持 active

#### Scenario: Reload 期间再次 Reload
- **WHEN** 已存在 active staged replacement 且 Host 再次发起 Reload
- **THEN** Host 以 `session/reload-in-progress` typed rejection 拒绝
- **THEN** 同时最多存在一套 replacement

#### Scenario: Parameter 迁移
- **WHEN** 新旧 descriptors 中同 id、同 type 且旧值满足新 Constraint
- **THEN** 该值迁移进 staged Store 并出现在 replacement boot snapshot
- **WHEN** type 变化、值违反新 Constraint 或参数为 computed
- **THEN** staged Store 使用新默认值，computed 由 Host 重算

### Requirement: Slate lifecycle 不阻塞 Canvas readiness
可选 Slate Container SHALL 独立于 Main readiness 启动，并 MUST NOT 延迟 Canvas first frame。

#### Scenario: Slate 在 Main 成功后失败
- **WHEN** Main Canvas 已 Ready，但 Slate loading 失败
- **THEN** Tool Session 对 Canvas 保持 Ready
- **THEN** Host 记录 Slate Surface diagnostic
