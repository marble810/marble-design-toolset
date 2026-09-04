# AGENTS

只保留必须严格遵守的框架级约束；目标 architecture 见 `docs/architecture/deshelf-architecture.md`。涉及 Catalog、Tool Container、Environment API 或 Tool Project migration 时，以目标 architecture 为准。

## Hard Constraints
- 样式基础层不得继续使用 Tailwind；统一使用 CSS Custom Properties 和 px 单位。
- 当前共享 UI 文案只写英文；应用按纯横屏设计；视口宽度小于 720px 时必须阻止正常工作区渲染。
- 交互型基础组件优先基于 Bits UI 包装：Button、Dialog、DropdownMenu、Popover、Collapsible、Tabs。
- 布局型组件必须手写，不用 Bits UI：ToolShell、LeftPanel、RightPanel、MainInfo、Section、PreviewCanvas 以及其他纯布局容器。
- 使用 Bits UI 的 `child` snippet 时，委托元素必须完整透传 `{...props}`；浮动内容必须保留外层 `{...wrapperProps}` + 内层 `{...props}` 双层结构，且外层不承载视觉样式。
- Workspace shell 拥有顶层布局与 Standard Inspector。Visual Tool 只声明 Canvas 与可选 Tool Slate，不能重新定义 Workspace shell 或渲染 Host panels。
- 目标 Tool Project 根目录只有一个 `manifest.json` 与固定 `index.ts` 两个登记点；`index.ts` 必须唯一 `export default defineVisualTool(...)`，且顶层无副作用。
- Tool Manifest 只保存静态身份、`contractVersion`、`forgeProfile` 与 Framework Libraries；不得写 `entry`、Parameter、Command、Inspector、Capability、Slate 或 Export。
- Tool Entry 中 Canvas 与 Tool Slate 必须按需动态 import；Tool 内部可按需拆 `parameters.ts`、`assets.ts`、`commands.ts`、`callbacks.ts`、`outputs.ts`、`inspector.ts`、`sim/`、`canvas/` 与 `slate/`，但不得形成第二个注册入口。
- Asset Slot、Tool Command、Inspector Private Callback 与 Visual Output 的稳定 ID 必须来自 Tool Entry named map key；private callback 禁止 inline anonymous handler，Canvas 禁止在 mount 后 runtime 注册 exporter。
- Catalog 必须由 Deshelf Forge 在构建期扫描、编译和抽取生成；作者不得手写 Catalog，Tool Session 不得运行时 `tool.register`。
- Web 使用 same-origin iframe Tool Container；Desktop 使用 WebContents + MessagePort Tool Container。两端共用 Environment API interface，只替换 transport adapter。
- 性能热路径必须留在 Tool Container：rAF、Three/Pixi/WebGPU、simulation state 与 Canvas pixels 不得经过 Environment API。
- Framework Libraries 只由 Forge Profile 供给并按 Tool Manifest 声明加载：`three`、`pixi`、`gsap`、`vgpu`。Tool 不得自带 `node_modules`、第三方 package 或自定义 Vite/Svelte 配置。
- Tool 的本地素材输入与 Export 必须通过 Host 提供的 environment adapters；Desktop 不得向 Tool 暴露真实文件路径。
- OpenSpec 采用 Proposal-Driven Schema（proposal → design → tasks，无 specs）；OpenSpec 文档（proposal、design、tasks 等 artifact）统一使用中文撰写。
- docs/ 目录下的开发者文档统一使用中文撰写。