## Why

当前仓库仍然更接近一个 SvelteKit 起始项目，样式体系依赖 Tailwind，tool 挂载逻辑也偏临时拼装。要继续增加更多工具之前，项目需要先建立一套严格的像素风工作区基础设施，用来明确壳层边界、样式规则、工具注册方式和运行时加载行为。

## What Changes

- 用基于 CSS Custom Properties 的设计令牌系统替换以 Tailwind 为中心的 UI 基础层，并统一使用像素排版与间距单位。
- 引入一个工作区壳层，包括 Header、可打开与关闭的工具标签页、左右面板、设置界面、帮助与关于入口，以及支持缩放的预览舞台。
- 定义严格的工具模块契约，覆盖文件路径、命名规则、master 组件入口、metadata 与私有子组件组织方式。
- 增加运行时发现机制、基于 hash 的工具路由、本地工作区状态持久化，以及 Three.js、PixiJS、GSAP 的动态加载机制。
- 标准化像素风资源策略和贡献规范，包括 Bits UI 使用规则、仅英文文案，以及纯横屏布局约束。

## Capabilities

### New Capabilities
- `pixel-ui-foundation`：共享设计令牌、Bits UI 包装规则、像素图标与边框资源策略，以及视口约束。
- `tool-shell-workspace`：负责 Header、标签页、面板、对话框、设置、路由和预览交互的应用工作区壳层。
- `tool-module-runtime`：负责单个工具的注册、发现、命名、加载和技术栈依赖协议。

### Modified Capabilities
- 无。

## Impact

- 受影响代码：`src/app.css`、`src/routes/+page.svelte`、`src/lib/components/**`、`src/tools/**`、运行时状态与帮助模块，以及项目文档。
- 依赖影响：移除 Tailwind 相关包，新增像素图标与可选渲染/动画技术栈依赖。
- 开发流程影响：后续新增工具必须遵循严格目录 schema 和 Bits UI 组合规则。
- 文档影响：需要增加架构说明以及仓库级 AI / 贡献者指引。
