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

### Requirement: Tool Command timeout 影响 Session health
Ready Session SHALL 跟踪 Responsive 或 Unresponsive health。Tool Command SHALL single-flight，并使用 Deshelf Runtime Config timeout。若 callback 在 cancel 后仍未结束，Host SHALL 把 Session health 标记为 Unresponsive，并提供 Restart Tool，且不自动关闭 Container。

#### Scenario: Command 在 timeout 后不停止
- **WHEN** Host 发送 cancel 且 callback 仍处于 active
- **THEN** Session health 变为 Unresponsive
- **THEN** 对应 Host controls 保持 unavailable
- **THEN** 用户可以选择 Restart Tool

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

### Requirement: Slate lifecycle 不阻塞 Canvas readiness
可选 Slate Container SHALL 独立于 Main readiness 启动，并 MUST NOT 延迟 Canvas first frame。

#### Scenario: Slate 在 Main 成功后失败
- **WHEN** Main Canvas 已 Ready，但 Slate loading 失败
- **THEN** Tool Session 对 Canvas 保持 Ready
- **THEN** Host 记录 Slate Surface diagnostic
