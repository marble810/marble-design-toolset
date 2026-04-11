## Context

当前应用是一个静态 SvelteKit 工作区，带有 starter README、基于 Tailwind 的样式，以及一个在页面层直接挂载工具的 component map。现有工具把壳层布局和工具自身控制逻辑混在一起，导致工作区无法稳定扩展。

已确认的目标状态是一套像素风设计工作区，并且具备以下硬约束：

- 共享样式由 CSS Custom Properties 和像素单位编写
- 交互型原子组件基于 Bits UI 包装，布局型原子组件继续手写
- 当前工作区只写英文文案、按纯横屏使用，并且在 720px 以下受限
- tool 模块必须遵循严格的目录和命名 schema
- 重型渲染与动画技术栈仅在工具声明后按需加载

核心干系人包括仓库维护者、未来的 tool 作者，以及需要依赖稳定契约生成合规组件的 AI 协作流程。

## Goals / Non-Goals

**Goals:**

- 在继续增加工具前，建立稳定且可长期维护的视觉与运行时基础设施
- 把壳层行为集中到框架中，让工具只负责自己的参数区和预览内容
- 编码出可预测的工具发现、命名、metadata 与运行时加载契约
- 通过 metadata eager discovery 和组件、依赖 lazy loading 的拆分来保持工作区性能
- 让 Bits UI 的使用方式与其 llms 文档中的 child snippet、state、styling 和 transition 规则对齐

**Non-Goals:**

- 一次性产出所有组件状态的最终像素美术方案
- 增加竖屏布局、移动优先行为或大范围响应式变体
- 现在就实现所有未来工具能力
- 引入后端服务或非前端运行时依赖

## Decisions

### 1. 用 CSS custom properties 和 scoped CSS 取代 Tailwind

工作区将移除 TailwindCSS、Tailwind 专用的 Vite 插件，以及只用于 class 合并的辅助工具。共享设计令牌放在 `src/app.css` 中，组件级样式保留在 Svelte scoped `<style>` 或有限的全局选择器中。

为什么不保留 Tailwind：

- 项目需要对间距、边框和像素表现进行精细控制
- 工具类布局会鼓励壳层结构渗入 tool 内部
- 当前设计方向足够定制化，框架抽象带来的噪音大于收益

考虑过的替代方案：

- Sass / SCSS：当前不采用，因为 CSS variables 已能覆盖所需令牌系统，无需再增加预处理层

### 2. 用 shell + runtime 分层替代页面层直接渲染工具

工作区职责划分为：

- `ui`：可复用交互原子组件包装层
- `shell`：应用布局和工具工作区展示层
- runtime：负责发现工具、恢复状态、更新 hash 路由，以及门控依赖加载
- tool modules：只导出自己的 metadata 和内容入口

为什么不继续在 `+page.svelte` 中直接管理工具渲染：

- 这样才能强约束左右面板结构
- 壳层才能拥有统一持久化行为
- 避免每个工具重新实现 zoom、info menu、route sync 等通用逻辑

考虑过的替代方案：

- 让每个工具完全自行负责布局：不采用，因为这违反了“工具顶层结构必须由框架严格限制”的核心要求

### 3. 每个工具保留一个 master Svelte 入口，私有子组件统一放在 `components/`

每个工具保留一个位于根目录的 master `.svelte` 文件，并允许把内部 UI 拆分到 `components/` 下的私有子组件中。运行时只认识 master 组件。

为什么不把每个工具拆成左右两个公开入口：

- 共享状态可以留在一个 master 组件里，结构更简单
- tool 作者仍然可以自由拆分内部实现，但不会削弱对外契约
- runtime 只需要认识一个挂载目标

考虑过的替代方案：

- 左右 entrypoint + 共享状态工厂：不采用，因为它为每个工具增加了额外样板代码，对简单工具尤其不划算

### 4. metadata eager load，runtime definition lazy load

运行时将：

- eager import 所有 `metadata.json`，让 Open 对话框和工具目录能立即可用
- 在真正打开某个工具时，再 lazy import 该工具的 `index.ts` 与 master 组件

为什么不把所有工具模块都 eager load：

- 工具列表必须立即可见
- 重型工具代码和其声明的技术栈不应影响首屏加载

考虑过的替代方案：

- metadata 和 runtime 全部 lazy：不采用，因为那样连工具目录本身都要在工作区渲染前等待异步解析

### 5. 使用 hash routing，而不是按工具建立文件路由

活动工具通过 `/#tool-id` 表示，标签页状态从 localStorage 恢复，并与当前 URL hash 对齐。

为什么不使用 SvelteKit 文件路由：

- 部署目标是静态托管
- 应用概念上是一个单一工作区，而不是内容型站点
- 工具分享与恢复只需要可书签化状态，不需要完整路由树

考虑过的替代方案：

- 纯内存状态且不反映到 URL：不采用，因为这会失去可分享链接和可预测恢复行为

### 6. Bits UI 仅用于交互原子组件，并遵循 llms.txt 的组合规则

项目将为 Button、Dialog、DropdownMenu、Popover、Collapsible 和 Tabs 提供 Bits UI 包装层。ToolShell、MainInfo、Section 和 PreviewCanvas 之类的布局结构保持手写。

这些包装层必须保留以下 Bits UI 规则：

- 透传组件 props 和 data attributes，而不是照搬 demo 样式
- 使用 `child` 时，把 `{...props}` 展开到委托元素上
- 浮动内容必须保留外层无样式 `wrapperProps` 和内层带样式 `props` 结构
- 使用 `forceMount + child` 为 Svelte transition 或 GSAP 动画提供进入退出控制

为什么不把所有交互逻辑都手写：

- 键盘导航、焦点管理和 aria 处理，Bits UI 已经提供了成熟实现
- 项目仍然保留完整样式控制权，这是 Bits UI 的优势所在

考虑过的替代方案：

- 保留现有自定义 dialog / button：不采用，因为这会重复实现项目已明确决定交给 Bits UI 统一处理的可访问性和交互行为

### 7. 提供共享预览舞台，而不是每个工具自行实现缩放

右侧面板会用一个由壳层拥有的预览舞台承载内容，提供：

- 棋盘格背景
- Fit 模式和 1:1 模式
- 缩放百分比显示
- 放大 / 缩小控件
- 滚轮缩放与拖拽平移

为什么不让每个工具自己做预览交互：

- 这类交互属于通用工作区行为，不是工具自身能力
- 工具应专注于“渲染什么”，而不是“预览舞台如何操作”

考虑过的替代方案：

- 只有 auto-fit，没有工具栏：不采用，因为用户明确要求一个可缩放的 canvas-like workspace，而不是被动展示框

### 8. 用 registry 驱动的动态加载系统管理可选技术栈

工具可声明的可选技术栈为 `three`、`pixi` 和 `gsap`。壳层通过共享 registry 加载缺失模块，并在后续重复使用时复用缓存。

为什么不在工具内部直接 import：

- 壳层可以在依赖就绪之前先门控渲染
- 多个工具可以共享单次加载后的模块实例
- 依赖可见性由工具契约声明，而不是藏在组件内部

考虑过的替代方案：

- 首屏后后台预加载全部技术栈：在当前阶段不采用，因为在没有证据表明需要投机式预加载前，这只会增加复杂度

## Risks / Trade-offs

- [严格 schema 会增加写 tool 的门槛] → Mitigation: 提供明确目录契约、示例和 AGENTS.md 指导。
- [移除 Tailwind 需要较大范围的第一轮重写] → Mitigation: 分阶段迁移，先做 tokens 和 shell wrappers，再迁移 tool 内部实现。
- [Bits UI child snippet 在浮动组件上容易被误用] → Mitigation: 为常见 menu / dialog / popover 抽出包装组件，并把 wrapper 规则写入 AGENTS.md。
- [Hash 恢复与本地持久化可能产生冲突] → Mitigation: 明确优先级，让有效 hash 优先，再围绕它协调标签页状态。
- [共享预览舞台未必覆盖未来所有工具] → Mitigation: 把它定义成通用 preview container，而不是强制真实 `<canvas>`，让 DOM、Canvas、PixiJS 和 Three.js 内容都能承载。
- [SVG border-image 制作可能需要多轮迭代] → Mitigation: 先只做一套共享资源，待壳层稳定后再增加更多状态变体。

## Migration Plan

1. 移除 Tailwind 相关依赖，并以共享 design tokens 和 viewport guard 重建 `src/app.css`。
2. 引入 UI wrappers 与 shell 组件，先不急于迁移所有工具。
3. 增加工作区状态、hash 同步、tab 持久化和预览舞台交互模型。
4. 增加 tool runtime types、registry helpers 和 tech stack 加载门控。
5. 把现有工具迁移到严格目录 schema 与 shell 组合模型中。
6. 增加 AGENTS.md、更新仓库文档，并验证静态构建输出。

回滚策略：

- 保持每个迁移阶段足够小，在工具全部迁移完成前，工作区仍可临时回退到旧的 `+page.svelte` 渲染路径
- 尽量避免把依赖清理与大规模 tool 重写耦合在同一个提交里

## Open Questions

- 当前规划阶段已经没有阻塞性的架构问题。
- 具体 token 数值、border-image 美术资源，以及最终字体资源，都属于实现阶段可演进的细节。
