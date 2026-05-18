## ADDED Requirements

### Requirement: Tool session active 状态参与统一 host lifecycle
Tool session lifecycle SHALL 将 active / inactive 状态作为统一 host lifecycle 的核心阶段之一暴露给 tool。状态切换 MUST NOT 触发会话重建，但 MUST 能被 lifecycle-aware helper 和 tool 消费，用于暂停、恢复或延迟宿主相关任务。

#### Scenario: 活动标签切换
- **WHEN** 一个已打开 tool 从活动标签切换为非活动标签
- **THEN** 该 tool 的统一 host lifecycle 进入 inactive 阶段，而不会触发会话重建

#### Scenario: 工具重新激活
- **WHEN** 非活动 tool 再次成为活动标签
- **THEN** 统一 host lifecycle 回到 active 阶段，tool 可以据此恢复宿主相关任务
