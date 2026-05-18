# render-host-lifecycle Specification

## Purpose
定义 Pixi、Three 和 Canvas2D 类 tool 可复用的渲染宿主生命周期契约，使连续渲染、资源清理、session active 暂停恢复与导出注册保持一致。
## Requirements
### Requirement: Framework 提供 session-aware render host helper
Framework SHALL 提供可选的 render host lifecycle helper，用于 Pixi、Three 和 Canvas2D 类 tool 的通用生命周期管理。helper MUST 读取 tool session active 状态，并在 session inactive 时允许暂停 ticker、requestAnimationFrame、视频播放或其他连续渲染任务。

#### Scenario: Tool session 失活
- **WHEN** 已挂载 tool 从活动标签切换为非活动标签
- **THEN** 使用 render host helper 的渲染任务进入暂停状态，且 tool 组件不会被卸载

#### Scenario: Tool session 重新激活
- **WHEN** 已暂停的 tool session 重新成为活动标签
- **THEN** render host helper 恢复该 tool 声明的渲染任务

### Requirement: Render host helper 管理初始化与销毁
Render host helper SHALL 管理通用 host 资源的初始化和销毁，包括 DOM host 绑定、canvas 挂载、resize 订阅、animation frame 或 ticker 清理，以及 Pixi/Three renderer dispose。Tool MUST 仍然拥有领域场景、shader、simulation 和 frame render 逻辑。

#### Scenario: Tool 挂载渲染 host
- **WHEN** tool 使用 render host helper 初始化 Pixi、Three 或 Canvas2D host
- **THEN** helper 在 host 元素可用后创建渲染资源，并把 ready/error 状态暴露给 tool

#### Scenario: Tool 卸载渲染 host
- **WHEN** tool tab 被关闭并导致组件销毁
- **THEN** helper 清理它创建的 DOM、renderer、ticker、animation frame 和订阅资源

#### Scenario: Tool 自定义领域渲染
- **WHEN** tool 使用 render host helper
- **THEN** tool 仍可提供自己的 shader、scene、texture、simulation step 或 render callback

### Requirement: Render host helper 与 canvas export runtime 协作
Render host helper SHALL 提供注册 CanvasExporterDescriptor 的协作入口，使 tool 可以把 helper 管理的 canvas 或 render callback 注册到 framework-owned export runtime。helper MUST 在组件销毁时注销由它协助注册的 exporter。

#### Scenario: Tool 注册 helper 管理的 canvas exporter
- **WHEN** Pixi 或 Three host helper 创建了可导出的 canvas
- **THEN** tool 可以通过 helper 注册 kind 为 canvas 的 exporter，并在销毁时自动注销

#### Scenario: Tool 注册 render callback exporter
- **WHEN** tool 需要按 frameIndex 重放程序化输出
- **THEN** helper 允许 tool 提供 renderFrame callback，并把该 callback 注册为 kind 为 render 的 exporter

### Requirement: Render host helper 遵守可选技术栈加载约束
Render host helper SHALL 仅通过共享 tech stack runtime 加载 `three`、`pixi` 或 `gsap`，并 SHALL 保持这些依赖只在 tool 声明和实际打开后加载。

#### Scenario: Pixi 工具使用 render host helper
- **WHEN** tool definition 声明 `techStack: ['pixi']` 且 tool 被打开
- **THEN** helper 通过共享 runtime 获取 Pixi 模块，不把 Pixi 耦合进未打开工具或通用壳层首屏

#### Scenario: 未使用重型技术栈的工具
- **WHEN** tool 不声明 `three`、`pixi` 或 `gsap`
- **THEN** render host helper 不加载这些重型模块

### Requirement: Render host lifecycle 对齐统一 host lifecycle 阶段
Render host lifecycle helper SHALL 对齐统一 host lifecycle 的阶段语义，使 render host 的初始化、ready/error、active/inactive 切换、cleanup 和 exporter registration 可以被当作同一条宿主生命周期的一部分理解和组合。

#### Scenario: Tool 使用 render host helper 管理渲染资源
- **WHEN** tool 通过 render host helper 初始化 Pixi、Three 或 Canvas2D host
- **THEN** helper 暴露的 ready/error、active/inactive 和 cleanup 行为与统一 host lifecycle 语义保持一致

#### Scenario: Tool 卸载时存在 exporter 注册
- **WHEN** 使用 render host helper 的 tool 在组件销毁前已注册 exporter
- **THEN** helper 协助完成与统一 host lifecycle 对齐的 exporter 注销和资源清理

