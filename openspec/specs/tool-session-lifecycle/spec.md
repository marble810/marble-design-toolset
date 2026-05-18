# tool-session-lifecycle Specification

## Purpose
定义 Marble Design Toolset 中工具标签会话的保活、销毁、活动状态切换和实例身份稳定语义。
## Requirements
### Requirement: 已打开工具会话在标签切换时保持挂载
工作区 SHALL 为每个已打开工具维护一个稳定的工具会话。只要标签页仍处于打开状态，切换活动标签 MUST NOT 销毁或重新创建该工具会话。

#### Scenario: 用户切换到其他标签页后再返回
- **WHEN** 用户先打开工具 A，再打开工具 B，然后在未关闭工具 A 的前提下重新激活工具 A
- **THEN** 工作区复用工具 A 原有的已挂载会话
- **THEN** 工具 A 的内存态参数、预览导航状态和运行时注册结果保持不变

### Requirement: 关闭标签页会销毁对应工具会话
工作区 MUST 仅在用户显式关闭某个工具标签页时销毁该工具会话。被关闭的工具若之后再次打开，SHALL 以全新会话启动。

#### Scenario: 用户关闭后重新打开同一工具
- **WHEN** 用户关闭工具 A 的标签页，然后再次通过 Open 打开工具 A
- **THEN** 之前的工具 A 会话已被销毁
- **THEN** 新打开的工具 A 以初始状态创建全新会话

### Requirement: 会话活动状态切换不改变实例身份
工作区 SHALL 在任意时刻只标记一个已打开工具会话为活动状态，并将其余已打开工具会话标记为非活动状态；该状态切换 MUST NOT 改变各会话的实例身份。

#### Scenario: 用户在两个已打开工具之间切换活动标签
- **WHEN** 工具 A 和工具 B 都已打开，且用户把活动标签从工具 A 切换到工具 B
- **THEN** 工具 A 会话变为非活动状态但保持挂载
- **THEN** 工具 B 会话变为活动状态且不创建重复实例

### Requirement: Tool session active 状态参与统一 host lifecycle
Tool session lifecycle SHALL 将 active / inactive 状态作为统一 host lifecycle 的核心阶段之一暴露给 tool。状态切换 MUST NOT 触发会话重建，但 MUST 能被 lifecycle-aware helper 和 tool 消费，用于暂停、恢复或延迟宿主相关任务。

#### Scenario: 活动标签切换
- **WHEN** 一个已打开 tool 从活动标签切换为非活动标签
- **THEN** 该 tool 的统一 host lifecycle 进入 inactive 阶段，而不会触发会话重建

#### Scenario: 工具重新激活
- **WHEN** 非活动 tool 再次成为活动标签
- **THEN** 统一 host lifecycle 回到 active 阶段，tool 可以据此恢复宿主相关任务

