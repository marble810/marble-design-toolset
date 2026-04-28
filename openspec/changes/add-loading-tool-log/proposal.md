## Why

当前工具加载态只显示静态提示，用户无法判断加载卡在定义、技术栈还是组件导入阶段。为 Loading Tool 过程增加居中日志，可以让用户在等待工具打开时看到明确进度，并在失败前获得更可理解的上下文。

## What Changes

- 在工具会话的 Loading 界面中部显示加载日志列表。
- 将工具加载过程拆分为可见步骤，例如 runtime definition、declared tech stack、tool component、mount preparation。
- 日志需要随当前加载尝试刷新，重试或切换工具时清空旧尝试的日志。
- 加载失败时保留当前错误 UI，同时允许用户看到最近加载步骤的上下文。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `tool-module-runtime`: 工具运行时加载过程需要向 Loading UI 暴露并展示可读的步骤日志。

## Impact

- 影响 `src/lib/components/shell/tool-session/ToolSession.svelte` 的加载状态 UI 与加载流程状态管理。
- 可能新增局部加载日志数据结构或小型 helper，但不改变工具模块 contract、metadata schema、懒加载边界或可选技术栈 registry API。
- 不引入新依赖；UI 文案保持英文，OpenSpec artifact 使用中文。