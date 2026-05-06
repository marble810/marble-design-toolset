## ADDED Requirements

### Requirement: Tool runtime context 暴露稳定工具身份与运行时服务
工作区 SHALL 为每个已挂载 tool 提供稳定的 runtime context。该 context MUST 至少包含当前 `toolId`、metadata、session active 读取函数、声明的 menu actions、menu action dispatch 入口，以及已声明技术栈的读取方式。

#### Scenario: Tool 读取自身工具标识
- **WHEN** 已挂载 tool 通过共享 runtime context 读取 `toolId`
- **THEN** 返回值等于该 tool 所在目录的 kebab-case 标识符

#### Scenario: Framework 生成 tool 相关默认值
- **WHEN** framework 需要生成导出文件名、诊断消息或日志上下文
- **THEN** framework 使用 runtime context 中的真实 `toolId`，而不是从 metadata name 或 URL hash 反推

#### Scenario: Tool 未消费 runtime context
- **WHEN** 旧 tool 不读取新增 runtime context 字段
- **THEN** 该 tool 仍可按现有方式加载和渲染

### Requirement: Tool menu actions 通过 runtime definition 分发
ToolDefinition SHALL 支持声明 menu actions 及其运行时处理入口。工作区在 MainInfo 中渲染 menu actions 后，MUST 将用户选择的 action id 分发回当前 tool definition 的处理入口；未提供处理入口时，工作区 MUST 以无副作用方式忽略该 action。

#### Scenario: 用户触发 tool menu action
- **WHEN** tool definition 声明 action `reset` 并提供对应处理入口
- **THEN** 用户在 MainInfo 菜单中选择该 action 后，工作区调用当前 tool 的处理入口并传入 `reset`

#### Scenario: Tool 未提供 menu action handler
- **WHEN** tool definition 只声明 menu action 但没有处理入口
- **THEN** 工作区不会抛出运行时错误，且不会影响 About 菜单行为

### Requirement: Tool contract 可被自动校验
仓库 SHALL 提供自动校验，覆盖 tool 目录 schema、`metadata.json` 必填字段、唯一 root-level master `.svelte`、PascalCase master 文件名、`index.ts` default definition、`techStack` 白名单和 root-level 私有组件限制。

#### Scenario: Tool 目录包含多个 root-level Svelte 文件
- **WHEN** contract validation 扫描到某个 tool 根目录存在多个 `.svelte` 文件
- **THEN** validation 失败并指出对应 tool-id

#### Scenario: Tool metadata 缺失必填字段
- **WHEN** `metadata.json` 缺少 name、desc、tag 或 version
- **THEN** validation 失败并指出缺失字段

#### Scenario: Tool 声明不支持的 tech stack
- **WHEN** ToolDefinition 声明 `three`、`pixi`、`gsap` 之外的 tech stack key
- **THEN** validation 失败并阻止该声明进入共享加载链路

### Requirement: Workspace 入口职责拆分保持行为等价
工作区 SHALL 将 tab 操作、hash 同步、本地持久化、左面板宽度设置和 catalog 选择逻辑从顶层页面组件中拆分为可测试的 controller 或局部组件。拆分后 MUST 保持现有用户可见行为不变。

#### Scenario: 用户重新加载工作区
- **WHEN** 工作区拆分后在已有本地持久化状态下重新加载
- **THEN** 已打开工具、活动工具和左面板宽度恢复行为与拆分前一致

#### Scenario: 用户通过 hash 打开工具
- **WHEN** 浏览器以有效工具 hash 打开工作区
- **THEN** 对应工具被加入标签集合并成为活动工具，行为与拆分前一致