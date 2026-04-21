## ADDED Requirements

### Requirement: 工具 metadata 支持 enabled 硬开关
工作区 SHALL 支持在每个工具的 metadata.json 中声明 enabled 布尔字段，并在 metadata discovery 阶段将其解释为工具可用性的硬开关。为保持既有工具的兼容性，未声明 enabled 的工具 SHALL 被视为 enabled 为 true。

#### Scenario: 旧工具 metadata 未声明 enabled
- **WHEN** 工作区发现某个未声明 enabled 的工具 metadata
- **THEN** 该工具仍被视为启用状态，并继续参与 catalog 生成与合法工具 ID 集合构建

#### Scenario: 工具在 metadata 中被显式禁用
- **WHEN** 某个工具 metadata 声明 `"enabled": false`
- **THEN** 该工具不会出现在工作区工具目录清单中，且不会被加入可打开的合法工具 ID 集合

### Requirement: 被禁用工具不会通过路由或恢复链路重新激活
工作区 SHALL 在 hash 路由解析和本地持久化恢复阶段将 enabled 为 false 的工具视为不可用工具，并阻止其重新成为活动工具或已打开标签页的一部分。

#### Scenario: 浏览器以被禁用工具的 hash 打开工作区
- **WHEN** 当前 URL hash 指向一个 enabled 为 false 的工具
- **THEN** 工作区不会激活该工具，并回退到其余可用的持久化状态或空状态

#### Scenario: 本地持久化中包含被禁用工具
- **WHEN** 工作区从本地持久化恢复已打开工具集合或活动工具
- **THEN** 所有 enabled 为 false 的工具 ID 都会在恢复阶段被清理，不会重新进入 openToolIds 或 activeToolId