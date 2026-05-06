# tool-module-runtime Specification

## Purpose
定义 Marble Design Toolset 的工具模块运行时约束，包括目录 schema、metadata 合约、定义发现方式与懒加载边界。
## Requirements
### Requirement: 每个工具遵循严格的文件系统 schema
每个工具 SHALL 位于 `src/tools/<tool-id>/` 之下，并且 SHALL 提供 `index.ts`、`metadata.json` 以及一个文件名与工具标识 PascalCase 形式严格对应的 master Svelte 入口组件。该工具的其他 Svelte 文件 SHALL 位于 `components/` 目录中。

#### Scenario: 仓库中新增一个工具
- **WHEN** 贡献者创建一个新的工具模块
- **THEN** 该工具包含 `index.ts`、`metadata.json`、一个位于工具根目录中的 master 入口组件，以及仅位于 `components/` 下的私有 Svelte 子组件

#### Scenario: 贡献者检查工具目录
- **WHEN** 贡献者查看某个工具目录的根目录
- **THEN** 该目录中恰好存在一个 root-level 的 Svelte 入口组件

### Requirement: 每个工具暴露运行时定义
每个工具 SHALL 暴露一个运行时定义，其中包括 metadata、可选 menu actions、可选 tech-stack 声明，以及 master 入口组件的懒加载器。

#### Scenario: 运行时解析工具定义
- **WHEN** 工作区运行时加载某个工具定义
- **THEN** 它可以从该定义中读取工具 metadata、menu actions、声明的 tech stack 以及懒加载组件加载器

### Requirement: 工具 metadata 可在不加载运行时代码的前提下被发现
工作区 SHALL 对所有工具 metadata 进行 eager discovery，同时保持工具运行时定义和入口组件延迟加载。

#### Scenario: 壳层需要工具目录清单
- **WHEN** 工作区在任何工具尚未打开前渲染工具列表
- **THEN** 它可以读取每个工具的 name、description、tags 和 version，而不加载该工具的运行时定义或入口组件

#### Scenario: 某个工具尚未被打开
- **WHEN** 工作区当前仅显示壳层空态或另一个工具
- **THEN** 未打开工具的入口组件不会仅为了填充工具目录而被加载

### Requirement: 工具加载态显示当前尝试的步骤日志
工作区 SHALL 在工具会话加载工具期间，于 Loading Tool 界面中部显示当前加载尝试的可读步骤日志。日志 MUST 至少覆盖工具定义加载、声明技术栈加载、工具入口组件加载以及准备挂载工具的阶段。日志 MUST 只反映当前工具会话的当前加载尝试；当用户切换到另一个工具 ID 或触发 Retry 时，工作区 MUST 清空旧尝试日志并从新尝试重新记录。

#### Scenario: 用户打开工具并看到加载步骤
- **WHEN** 用户打开一个尚未挂载的工具
- **THEN** Loading Tool 界面在中部显示当前加载尝试的步骤日志
- **THEN** 日志包含工具定义、声明技术栈、工具入口组件与准备挂载相关阶段

#### Scenario: 工具加载完成后移除加载日志
- **WHEN** 当前工具定义、声明技术栈和入口组件均加载成功
- **THEN** 工作区挂载该工具内容
- **THEN** Loading Tool 界面及其步骤日志不再显示

#### Scenario: 用户重试失败的工具加载
- **WHEN** 工具加载失败后用户激活 Retry
- **THEN** 工作区开始一次新的加载尝试
- **THEN** 新尝试的日志不包含上一次失败尝试的旧步骤

#### Scenario: 工具加载失败时保留最近步骤上下文
- **WHEN** 当前工具加载尝试失败
- **THEN** 工作区显示 Tool failed to load 错误状态与 Retry 控件
- **THEN** 错误状态保留当前失败尝试已经记录的步骤日志作为上下文

### Requirement: 可选技术栈通过共享 registry 声明与加载
运行时 SHALL 支持以 `three`、`pixi` 和 `gsap` 为 key 的共享、缓存、动态加载技术栈，并且 SHALL 通过共享的 key-to-module 类型映射把每个 key 绑定到对应的静态模块 contract。工作区 SHALL 仅在已打开工具声明这些依赖时才加载它们。`loadTechStack` MUST 在调用方传入确定的单个 key 时返回该 key 对应模块的静态类型；`loadTechStacks` MUST 在调用方保留字面量 key 集合时返回与该 key 集合同步的类型结果，并在 key 信息被宽化时退回安全的通用映射类型。上述类型增强 MUST NOT 改变现有懒加载与缓存复用语义。

#### Scenario: 工具声明渲染或动画技术栈
- **WHEN** 某个工具定义声明 `three`、`pixi` 或 `gsap`
- **THEN** 工作区在挂载该工具前通过共享 registry 加载缺失模块

#### Scenario: 两个工具声明同一技术栈
- **WHEN** 第二个工具在同一技术栈已经完成加载后被打开
- **THEN** 运行时复用缓存中的模块，而不是再次加载

#### Scenario: 工具按单个 key 加载共享技术栈
- **WHEN** 工具代码调用 `loadTechStack('pixi')`、`loadTechStack('three')` 或 `loadTechStack('gsap')`
- **THEN** 返回结果在静态类型上分别对应各自模块 contract，而不是统一退化为 `unknown`

#### Scenario: 工具按字面量 key 集合批量加载共享技术栈
- **WHEN** 工具代码以保留字面量信息的 key 集合调用 `loadTechStacks`
- **THEN** 返回对象的可访问 key 与每个 key 对应的模块类型和请求集合保持一致

### Requirement: 工具运行时可读取标签会话活动状态
工作区运行时 SHALL 向已挂载工具暴露可选的标签会话活动状态读取方式，使工具能够在保活标签模式下按需暂停或恢复后台资源。工具消费该状态时 MUST 无需感知或控制顶层标签页 DOM；工具不消费该状态时 MUST 继续保持兼容。

#### Scenario: 工具在标签失活时读取会话状态
- **WHEN** 某个已挂载工具从活动标签切换为非活动标签
- **THEN** 该工具可以通过共享运行时读取到非活动状态
- **THEN** 工作区不会因为该状态变化而卸载该工具

#### Scenario: 工具在重新激活时恢复前台行为
- **WHEN** 某个保活中的工具重新成为活动标签
- **THEN** 该工具可以通过共享运行时读取到活动状态
- **THEN** 该工具可以据此恢复动画帧、渲染循环或其他后台资源工作

#### Scenario: 旧工具未消费活动状态
- **WHEN** 某个现有工具不读取该共享运行时状态
- **THEN** 该工具仍可被工作区正常挂载、切换和关闭

### Requirement: 工具内容使用壳层拥有的 panel 包装组件
每个工具的 master 入口组件 SHALL 通过壳层拥有的 panel 包装组件组织自身 UI，从而让工具专属 UI 仅出现在其左侧和右侧 panel 区域内部。

#### Scenario: 工具组合私有 UI 片段
- **WHEN** 工具 master 组件从自身的 `components/` 目录导入私有子组件
- **THEN** 这些子组件只在该工具自己的左面板或右面板内容树内部渲染

#### Scenario: 工具提供菜单动作或 metadata 驱动信息
- **WHEN** 壳层渲染已挂载工具
- **THEN** 壳层可以注入基于 metadata 的信息区块和菜单动作，而无需工具重新定义工作区外框

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

