## ADDED Requirements

### Requirement: Render host lifecycle 对齐统一 host lifecycle 阶段
Render host lifecycle helper SHALL 对齐统一 host lifecycle 的阶段语义，使 render host 的初始化、ready/error、active/inactive 切换、cleanup 和 exporter registration 可以被当作同一条宿主生命周期的一部分理解和组合。

#### Scenario: Tool 使用 render host helper 管理渲染资源
- **WHEN** tool 通过 render host helper 初始化 Pixi、Three 或 Canvas2D host
- **THEN** helper 暴露的 ready/error、active/inactive 和 cleanup 行为与统一 host lifecycle 语义保持一致

#### Scenario: Tool 卸载时存在 exporter 注册
- **WHEN** 使用 render host helper 的 tool 在组件销毁前已注册 exporter
- **THEN** helper 协助完成与统一 host lifecycle 对齐的 exporter 注销和资源清理
