# AGENTS

只保留必须严格遵守的框架级约束；更完整背景见 docs/pixel-tool-framework-architecture.md 与 openspec/changes/establish-pixel-tool-framework/。

## Hard Constraints
- 样式基础层不得继续使用 Tailwind；统一使用 CSS Custom Properties 和 px 单位。
- 当前共享 UI 文案只写英文；应用按纯横屏设计；视口宽度小于 720px 时必须阻止正常工作区渲染。
- 交互型基础组件优先基于 Bits UI 包装：Button、Dialog、DropdownMenu、Popover、Collapsible、Tabs。
- 布局型组件必须手写，不用 Bits UI：ToolShell、LeftPanel、RightPanel、MainInfo、Section、PreviewCanvas 以及其他纯布局容器。
- 使用 Bits UI 的 `child` snippet 时，委托元素必须完整透传 `{...props}`；浮动内容必须保留外层 `{...wrapperProps}` + 内层 `{...props}` 双层结构，且外层不承载视觉样式。
- 工作区壳层拥有顶层布局。tool 只能渲染自己的左侧内容和右侧预览内容，不能重新定义顶层 workspace shell。
- 每个 tool 必须遵循严格目录 schema：`src/tools/<tool-id>/index.ts`、`metadata.json`、一个 root-level master `.svelte`，其余 `.svelte` 私有子组件全部放在 `components/`。
- `tool-id` 使用 kebab-case；master 组件文件名使用与 `tool-id` 对应的 PascalCase；工具根目录只允许一个 root-level `.svelte`。
- `metadata.json` 只放静态元数据；`index.ts` 负责 runtime definition；tool 组件按需懒加载。
- 可选技术栈只声明并通过共享 runtime 加载 `three`、`pixi`、`gsap`；不要在无声明前提下直接把重型依赖耦合进通用壳层。
- OpenSpec 文档（proposal、design、specs、tasks 等 artifact）统一使用中文撰写。
- docs/ 目录下的开发者文档统一使用中文撰写。