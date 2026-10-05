# AGENTS

这里只保留必须严格遵守的框架级约束；领域术语见 `CONTEXT.md`。`docs/` 仅保存开发 checkpoint 与 ADR；checkpoint 记录特定提交状态，ADR 记录已接受的架构决策。涉及 Host UI、Host Core、Native Services 或原型边界时，遵循 `docs/adr/0003-host-ui-core-native-services.md`。

涉及 Canvas 托管、Frame 声明、画布输入或布局恢复时，遵循 `docs/adr/0004-unified-canvas-and-frames.md`。

## Hard Constraints
- 旧 MDT → 新 Deshelf 采用破坏性重构，直接迁移到新契约；不保留旧 MDT 兼容层、适配分支或双轨实现，不以兼容旧实现为由保留废弃 API 或结构。该策略不豁免 Forge Profile 的版本不可变约束。
- 样式基础层不得继续使用 Tailwind；统一使用 CSS Custom Properties 和 px 单位。
- 当前共享 UI 文案只写英文；应用按纯横屏设计；视口宽度小于 720px 时必须阻止正常工作区渲染。
- 交互型基础组件优先基于 Bits UI 包装：Button、Dialog、DropdownMenu、Popover、Collapsible、Tabs。
- 布局型组件必须手写，不用 Bits UI：ToolShell、LeftPanel、RightPanel、MainInfo、Section、PreviewCanvas 以及其他纯布局容器。
- 使用 Bits UI 的 `child` snippet 时，委托元素必须完整透传 `{...props}`；浮动内容必须保留外层 `{...wrapperProps}` + 内层 `{...props}` 双层结构，且外层不承载视觉样式。
- Workspace shell 拥有顶层布局与 Standard Inspector。Canvas 外层布局、导航与 Frame 标题栏由 Deshelf 统一管理；Visual Tool 只声明 Canvas 中的 Frame 内容与可选 Tool Slate，不能重新定义 Workspace shell 或渲染 Host panels。
- 目标 Tool Project 根目录只有一个 `manifest.json` 与固定 `index.ts` 两个登记点；`index.ts` 必须唯一 `export default defineVisualTool(...)`，且顶层无副作用。
- Tool Manifest 只保存静态身份、`contractVersion`、`forgeProfile` 与 Framework Libraries；不得写 `entry`、Parameter、Command、Inspector、Capability、Slate 或 Export。
- Tool Entry 中 Canvas 的 Frame 内容与可选 Tool Slate 必须按需动态 import；Tool 内部可按需拆 `parameters.ts`、`assets.ts`、`commands.ts`、`callbacks.ts`、`outputs.ts`、`inspector.ts`、`sim/`、`canvas/` 与 `slate/`，但不得形成第二个注册入口。
- Asset Slot、Tool Command、Inspector Private Callback 与 Visual Output 的稳定 ID 必须来自 Tool Entry named map key；private callback 禁止 inline anonymous handler，Canvas 禁止在 mount 后 runtime 注册 exporter。
- Catalog 必须由 Deshelf Forge 在构建期扫描、编译和抽取生成；作者不得手写 Catalog，Tool Session 不得运行时 `tool.register`。
- Web 使用 same-origin iframe Tool Container；Desktop 使用 WebContents + MessagePort Tool Container。两端共用 Environment API interface，只替换 transport adapter；Container 不是恶意代码安全边界，Web 不承诺故障隔离。
- `tool-sdk` 只提供作者侧声明、Inspector builders 与 Container client；`tool-builder` 拥有扫描、编译、受控 extraction、校验与 Catalog 生成；`tool-host` 拥有 Session、Parameter Store 与 Inspector。
- Host 是 Parameter Store 唯一权威；Inspector 在构建期抽取，Main 执行运行回调；Slate 使用独立 realm，启动不阻塞 Canvas Ready。
- Catalog identity 必须区分 source/location 与 projectId；Reload 采用 staged replacement，Canvas Ready 后原子切换，失败保留旧 Session；Restart 不构建，Reset Defaults 不替换 Container。
- 性能热路径必须留在 Tool Container：rAF、Three/Pixi/WebGPU、simulation state 与 Canvas pixels 不得经过 Environment API。
- Framework Libraries 只由 Forge Profile 供给并按 Tool Manifest 声明加载：`three`、`pixi`、`gsap`、`vgpu`。Tool 不得自带 `node_modules`、第三方 package 或自定义 Vite/Svelte 配置。
- Tool 的本地素材输入与 Export 必须通过 Host 提供的 environment adapters；Desktop 不得向 Tool 暴露真实文件路径。
- OpenSpec 采用 Proposal-Driven Schema（proposal → design → tasks，无 specs）；OpenSpec 文档（proposal、design、tasks 等 artifact）统一使用中文撰写。
- `docs/` 只存放中文开发 checkpoint 与 ADR；checkpoint 记录基线提交、变更范围、验证结果、已知限制与下一步，ADR 记录决策及理由；不作为前端内容源，不恢复文档站。

## UI Prototype Relationship
- 同级目录 `../deshelf-ui-prototype/` 是本仓库的独立 Host UI 原型 companion project，不是本仓库的 workspace、package 或构建输入。
- 主仓库负责生产实现：Host UI 接入真实 Host Core，并按需通过 Platform Adapters 使用 Web 或 Native Services。
- UI 原型只允许采用 `Host UI → Mock Host Core` 边界；不得导入、链接、复制运行或复用主仓库的 Host Core、Tool Container、Catalog、Environment API、Desktop adapter 或 Native Services。
- 原型不得通过 workspace dependency、file dependency、path alias、symlink、共享运行时或 HTTP/IPC 调用绕过上述边界；Mock 数据、状态和行为必须留在原型仓库内。
- 原型验证的是界面结构、交互和状态表达；结论回写到主仓库后，生产实现须根据真实 Host Core 重新实现，不直接把原型代码当作生产代码合并。
- 主仓库的变更不得把原型目录加入应用构建、测试、发布或运行时依赖；两者通过 ADR、checkpoint 和设计结论关联，不通过代码依赖关联。