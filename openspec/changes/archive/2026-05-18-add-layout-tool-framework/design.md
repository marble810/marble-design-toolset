## Context

当前 Marble Design Toolset 已具备普通 tool module schema、PreviewCanvas、tool IO facade、file-input pipeline、canvas export runtime 和交互式脚手架。平面版式模板工具的需求与这些基础设施高度重叠，但仍缺少一层面向 “template as a tool” 的统一抽象：

- 每个版式模板仍应是独立 tool，以保留 Svelte 组件和 CSS 的最大自由度。
- 版式模板需要动态画布尺寸，且由 tool 开发者定义 min / max / default 边界。
- 版式模板常需要多个命名素材输入，例如 hero image、logo、avatar、uploaded font。
- 版式模板需要 Google Fonts 与用户上传字体，并在纯前端 GitHub Pages 环境下工作。
- 版式模板应走框架 Export panel，而不是在 tool 内自行下载。

现有 `CanvasExporterDescriptor` 已包含 `kind: 'dom'`，但 DOM 导出实现仅 clone DOM 到 SVG foreignObject，无法可靠收集 Svelte scoped CSS、字体与图片资源。现有 file-input pipeline 只覆盖 `image`、`video`、`text` 的单输入语义，也不能表达多个命名输入 slot 或字体上传。

## Goals / Non-Goals

**Goals:**

- 在现有技术栈基础上增加一个 headless layout-tool 子框架，并作为 `$lib/tool-sdk/index.js` 的正式导出面。
- 提供 `createLayoutToolController` 总 controller，集中管理尺寸、source slots、字体与 DOM 导出注册。
- 扩展 file-input / tool IO，使其支持多个命名输入 slot，并向前兼容现有单输入 UI 与 workflow。
- 新增 `font` 文件输入 kind，用于用户上传 `.ttf`、`.otf`、`.woff`、`.woff2` 等字体文件。
- 将 DOM PNG 导出升级为框架原生能力，内部使用 `html-to-image`，对 tool 开发者隐藏第三方库细节。
- 新增 `layout-template` 脚手架 recipe，生成完整可运行示例。
- 在 `docs/` 下提供面向 tool 开发者的 layout-tool 使用指南。

**Non-Goals:**

- 不做 Figma / Canva 式自由拖拽编辑器。
- 不引入布局 DSL 或模板 schema 来描述 DOM 结构；DOM、组件拆分和 CSS 仍由 tool 开发者自由编写。
- 第一版不支持 SVG / PDF 导出，只支持现有 Export panel 的 PNG 1x / 2x / 4x。
- 第一版不提供 CanvasSizeControls、FontControls、ColorControls 等标准 UI 组件；只提供 headless controller。
- 第一版不做在线字体目录搜索 UI；Google Font family 由用户或 tool UI 传入。
- 第一版不做图像裁剪、fit/crop 策略、尺寸比例校验或默认占位资源，这些由具体 layout tool 决定。

## Decisions

### 1. 每个模板仍是独立 tool，layout 能力作为 SDK 子框架

版式模板使用既有 `src/tools/<tool-id>/` schema：`metadata.json`、`index.ts`、唯一 root-level master `.svelte` 和私有 `components/`。layout-tool 子框架不改变 workspace shell，也不创建新的顶层 tool host。

**原因：**

- 保持现有 tool registry、metadata、lazy loading、export 声明和 PreviewCanvas 约束不变。
- 每个模板拥有完整 Svelte + CSS 自由度，避免把复杂版式抽象成过早的 DSL。
- 后续可以通过脚手架 recipe 快速生成同一类工具，而不是让框架直接管理模板市场或模板集合。

**替代方案：**

- 一个 `layout-designer` tool 内部切换模板：公共逻辑集中，但单 tool 内复杂度和权限边界会迅速膨胀。
- 纯 schema 驱动模板：有利于模板市场，但会牺牲 Svelte/CSS 灵活性，不符合当前需求。

### 2. 使用一个总 controller，但保持 headless UI

公开入口采用：

```ts
createLayoutToolController({
	size,
	sources,
	fonts,
	export
});
```

controller 管理基础状态、校验、异步加载、诊断和生命周期；tool 开发者自己编写 LeftPanel UI 和预览 DOM。

**原因：**

- 用户明确希望“全部 controller 化”，减少每个模板重复实现状态和生命周期。
- 不提供标准 UI 组件，可以保留模板开发者对控件组织、视觉层级和字段组合的自由度。
- 显式 `{ size, sources, fonts, export }` 分区便于文档教学和脚手架生成。

**替代方案：**

- 多个独立 controller：更灵活，但 recipe 和文档入口较分散。
- 纯函数 helper：API 更薄，但字体加载、FontFace 清理、导出注册和 warning 透出会在每个 tool 重复。

### 3. 多素材输入升级为通用 named source slots

file-input pipeline 和 tool IO 增加 source slot 概念。每个 slot 使用稳定 `id` 作为 key，包含英文 `name`、英文 `desc`、`allowedKinds`、`required`、`accept`、`maxSizeMB` 等基础声明。

单输入场景可视为默认单 slot，SourceInputSection 自动检测：

- 单 slot：保持现有 UI 逻辑。
- 多 slot：渲染 slot 列表或分组，每个 slot 有独立状态、错误、清理和 picker/drop 入口。

**原因：**

- 平面模板常需要多个角色明确的图像或字体输入，命名 slot 比文件列表更贴合 “hero / logo / font” 的语义。
- 将能力放入通用 IO 层可惠及 layout 以外的 tool。
- 保持 SourceInputSection 自动兼容可减少迁移成本。

**替代方案：**

- `images[]` 文件列表：适合图库，但无法表达每个素材位置的 required / desc / accept 约束。
- layout controller 私有实现多输入：短期快，但会复制 file-input 的错误、对象 URL 清理和 drop 逻辑。

### 4. 新增 `font` kind，并让 Google Fonts 与上传字体进入统一字体管线

字体来源分两类：

- Google Fonts：运行时根据 family 生成 Google Fonts CSS URL，fetch CSS，再 fetch `fonts.gstatic.com` 字体文件，转换为 data URL / font-face CSS。
- 用户上传：通过 `font` kind 读取字体二进制，转换为 data URL / font-face CSS。

两条路径最终都向 controller 产出可注入的 `@font-face` CSS，并通过 FontFace / `document.fonts` 等浏览器 API 等待字体可用。

**原因：**

- 纯前端 GitHub Pages 可以使用 `fetch` 和 File API 完成上述流程，无需服务端。
- 将远程字体和上传字体统一到 data URL 后，DOM 导出更可控。
- Google Fonts 加载失败时不阻止用户继续设计；导出面板显示 warning，并回退系统字体。

**替代方案：**

- 只允许 tool 开发者预置字体列表：最稳定，但不满足任意 family 输入。
- 字体上传不进 file-input：实现快，但会形成第二套 binary 文件读取和错误处理。

### 5. DOM 导出使用 `html-to-image`，但不把第三方 options 泄漏为公开 contract

`kind: 'dom'` exporter 的 PNG 路径由框架内部调用 `html-to-image`。tool 或 layout controller 只能配置少量框架定义的安全选项：

- `backgroundColor`
- `filter`
- `cacheBust`
- `style` overrides

Export panel 仍控制 scale、filename、任务状态和结果显示。

**原因：**

- `html-to-image` 对 CSS 变量、字体内嵌、图片 inline 和 DOM 节点捕获更适合 layout template。
- 完整 passthrough 会把 SDK surface 绑定到第三方库 API，未来替换实现会困难。
- 完全隐藏选项又无法排除辅助线、debug overlay 或导出时临时样式。

**替代方案：**

- 继续使用手写 SVG foreignObject clone：依赖样式复制和字体处理，保真度风险更大。
- tool 自己调用 html-to-image：会绕过统一 Export panel 和 runtime diagnostics。

### 6. 脚手架生成完整 layout-template 示例

`bun run create:tool` 增加 `layout-template` recipe。生成结果必须符合 tool module schema，并示范：

- 动态尺寸 min / max / default。
- 多个 source slots。
- Google Font 输入。
- 用户上传字体。
- `PreviewCanvas` 中的 DOM layout root。
- 通过 layout controller 注册 DOM exporter。

**原因：**

- 完整示例可以验证 SDK 闭环，也能作为 tool 作者的最佳实践入口。
- layout template 涉及 IO、字体、导出多个模块，最小示例无法暴露关键集成细节。

## Risks / Trade-offs

- **`html-to-image` 与真实浏览器渲染仍可能存在差异** → 通过 docs 明确支持边界，第一版聚焦 PNG；导出失败和降级必须在 Export panel 中显式报告。
- **任意 Google Font family 输入可能失败或缺少字重** → controller 将失败转为 warning，回退系统字体；不静默成功。
- **多 slot SourceInputSection 可能变复杂** → 保持单 slot UI 完全兼容，多 slot 只增加分组渲染，不改变现有 workflow 字段含义。
- **总 controller API 过早膨胀** → 第一版仅包含 `size`、`sources`、`fonts`、`export` 四块；图像裁剪、尺寸比例、PDF/SVG 导出、标准 UI 组件均排除。
- **新增 `font` kind 涉及二进制文件读取和资源清理** → 复用 file-input 的错误语义和 dispose 入口，不在 layout controller 内复制读取流程。
- **第三方依赖增加首屏体积** → `html-to-image` 应按导出路径懒加载，避免普通工具首屏加载该依赖。

## Migration Plan

1. 扩展 file-input 类型、helpers、readers 和测试，先支持 `font` kind 与单 slot 兼容。
2. 增加 source slot collection controller，并让单 slot workflow 继续保留原 API 或提供兼容 facade。
3. 扩展 SourceInputSection / DropZone，使其自动兼容单 slot 和多 slot。
4. 升级 canvas export 的 `dom` PNG 路径为懒加载 `html-to-image`。
5. 在 tool SDK 中加入 `createLayoutToolController`，内部组合 size、sources、fonts 和 export。
6. 增加 `layout-template` 脚手架 recipe。
7. 编写 `docs/for-tool-developers/` 下的 layout-tool 使用文档。

若出现问题，可在不破坏现有工具的前提下回滚 layout controller 和 recipe；file-input 的单 slot 兼容行为必须通过测试保障。

## Open Questions

- `font` kind 首版是否需要读取字体 metadata（family / style / weight），还是仅使用用户或 tool 指定的 family 名称。
- SourceInputSection 的多 slot 视觉分组是否需要折叠能力，还是第一版使用简单列表。
- Google Fonts CSS 解析是否只支持常见 `@font-face` URL，还是需要覆盖 variable font 的全部 axes metadata。
