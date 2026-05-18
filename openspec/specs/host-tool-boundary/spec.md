# host-tool-boundary Specification

## Purpose
TBD - created by archiving change define-host-tool-boundary. Update Purpose after archive.
## Requirements
### Requirement: Framework 与 tool 的职责边界必须显式定义
Framework SHALL 显式定义 host owns 与 tool owns 的职责边界。Host owns 至少包括 tool discovery / loading、workspace shell ownership、runtime capability 提供、生命周期编排、失败隔离与兼容策略；tool owns 至少包括内部状态模型、组件拆分、领域渲染实现和业务逻辑。Framework MUST NOT 把 tool 的内部实现方式纳入宿主 contract。

#### Scenario: 作者实现自定义渲染逻辑
- **WHEN** 一个 tool 在满足宿主 contract 的前提下重构自己的内部组件树、状态模型或渲染实现
- **THEN** framework 仍将其视为有效 tool，且不因为内部实现变化而要求额外宿主适配

#### Scenario: Framework 调整 workspace orchestration
- **WHEN** framework 重构 tool discovery、workspace controller 或 shell 内部实现
- **THEN** 这些内部变化不会自动成为 tool 必须跟随的 contract

### Requirement: Tool 只能通过 public boundary 接入宿主能力
Tool SHALL 仅通过 public SDK、声明过的 capability 和 extension point 接入宿主能力。Tool MUST NOT 将 framework internal 模块路径、私有 helper 或未声明的 controller 细节当作长期依赖面。

#### Scenario: Tool 需要 source input 或 export 能力
- **WHEN** 一个 tool 需要接入 source input、export、render host 或 lifecycle
- **THEN** 它通过 public boundary 暴露的 capability 或 extension point 完成接入

#### Scenario: Tool 尝试依赖 internal runtime 模块
- **WHEN** 一个 tool 直接依赖被标记为 internal 的 framework 模块路径
- **THEN** 该依赖不被视为受支持的宿主 contract，且自动校验会将其识别为 boundary 违规

### Requirement: Public boundary 变更必须提供迁移路径
当 framework 需要调整 public boundary 时，MUST 提供显式的 deprecation 与 migration path。Framework MUST NOT 通过仅重构 internal 模块而隐式打破现有 tool。

#### Scenario: Public SDK 入口弃用
- **WHEN** framework 准备替换一个 public SDK 入口
- **THEN** 文档、脚手架和迁移说明同时提供替代入口和兼容窗口

#### Scenario: Internal 模块重构
- **WHEN** framework 仅重构 internal 模块结构且 public boundary 不变
- **THEN** 依赖 public boundary 的 tool 不需要修改代码

### Requirement: Tool 失败必须限制在宿主边界内
Tool 的加载失败、初始化失败或运行时异常 MUST 被限制在对应 tool 会话或 tool 边界内。Framework shell、其他已打开 tool 会话和 workspace 持久化状态 MUST 保持可用。

#### Scenario: 单个 tool 加载失败
- **WHEN** 一个 tool 在定义加载、组件加载或初始化期间失败
- **THEN** framework 仅在该 tool 会话内显示失败状态，workspace shell 和其他 tool 会话继续可用

#### Scenario: Tool 运行时抛出异常
- **WHEN** 一个已挂载 tool 的内部逻辑抛出异常
- **THEN** framework 将故障限制在当前 tool 边界内，而不会导致整个 workspace 丢失可用性

### Requirement: Host–Tool isolation 支持分级演进
Framework SHALL 支持分级隔离策略。默认的 trusted in-repo tool 层至少要求 public boundary 隔离；更强的隔离层 MAY 在未来通过 worker、iframe 或其他 sandbox 机制引入，但 MUST 保持通过 capability allowlist 和 message bridge 接入宿主能力。

#### Scenario: 当前仓库内 tool 接入宿主
- **WHEN** 一个仓库内 trusted tool 被加载
- **THEN** framework 以 public boundary 隔离作为默认策略，而不要求该 tool 进入额外 sandbox

#### Scenario: 未来引入更强隔离层
- **WHEN** framework 为某类 tool 引入更强隔离层
- **THEN** 该层继续通过 capability allowlist 和显式 bridge 与 host 通信，而不是允许直接访问宿主 internals

