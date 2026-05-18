## ADDED Requirements

### Requirement: Exporter 注册生命周期与统一 host lifecycle 对齐
Canvas export runtime SHALL 允许 tool 或 helper 在统一 host lifecycle 语义下注册和注销 exporter。凡是由 lifecycle-aware helper 协助注册的 exporter，framework MUST 在对应 lifecycle cleanup 阶段自动注销，避免把无效 exporter 留在当前会话中。

#### Scenario: 生命周期驱动的 exporter 注销
- **WHEN** 一个 tool 通过统一 host lifecycle 协助注册 exporter，随后对应组件销毁或会话结束
- **THEN** framework 自动注销该 exporter，并且 Export UI 不再尝试调用它

#### Scenario: Tool 进入非活动状态
- **WHEN** 一个已注册 exporter 的 tool 从 active 切换为 inactive
- **THEN** exporter 是否继续可用由统一 host lifecycle 定义的策略决定，但其状态变化仍受同一套生命周期语义约束
