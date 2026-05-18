# tool-host-lifecycle Specification

## Purpose
TBD - created by archiving change unify-tool-host-lifecycle. Update Purpose after archive.
## Requirements
### Requirement: Framework 提供统一的 tool host lifecycle 语义
Framework SHALL 为 tool 提供统一的 host lifecycle 语义，至少覆盖 init、ready/error、active/inactive、cleanup 和 exporter registration。该 lifecycle MUST 作为宿主与 tool 的组合边界存在，而不是强制规定 tool 的内部渲染实现。

#### Scenario: Tool 初始化宿主资源
- **WHEN** 一个 tool 需要初始化渲染 host、订阅 active 状态并注册 exporter
- **THEN** 它可以通过统一的 host lifecycle 语义协调这些宿主行为

#### Scenario: Tool 保持自有渲染逻辑
- **WHEN** 一个 tool 使用统一 host lifecycle
- **THEN** tool 仍然自行拥有 scene、shader、simulation 和 frame render 逻辑

### Requirement: 统一 host lifecycle 与容器模式解耦
Host lifecycle MUST 与具体右侧容器选择解耦。无论 tool 使用 PreviewCanvas、FullStage 还是自定义 RightPanel 内容，统一 host lifecycle 的语义都 SHALL 保持一致。

#### Scenario: Tool 使用 PreviewCanvas
- **WHEN** 一个 tool 在 PreviewCanvas 中接入统一 host lifecycle
- **THEN** 其 init、active/inactive、cleanup 和 exporter registration 语义与其他容器模式保持一致

#### Scenario: Tool 使用 FullStage
- **WHEN** 一个 tool 在 FullStage 或自定义右侧内容中接入统一 host lifecycle
- **THEN** framework 继续提供相同的宿主生命周期语义，而不要求 tool 切换到特定容器

