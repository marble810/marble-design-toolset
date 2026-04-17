## 为什么

当前工作区强制所有工具通过 `PreviewCanvas` 渲染右侧内容——一个带固定工具栏和棋盘格背景的缩放/适配/平移画布。这对静态 2D 预览工具（如 aspect-ratio）有效，但对 WebGL/PixiJS 场景来说是错误的（CSS transform scale ≠ 真实渲染分辨率），也不适合全屏交互舞台，更无法满足未来的工具类型，例如 CSS+Svelte 排版工具或动画预设编辑器。工具需要自由选择右侧面板的内容呈现方式，同时共享一致的视觉基线。

## 变更内容

- **BREAKING**：`RightPanel` 获得背景色（`--color-bg-panel`）作为视觉基线，并移除 `PreviewCanvas` 是其唯一子组件的隐式假设。工具现在可以直接在 `RightPanel` 内渲染任意内容。
- **BREAKING**：`PreviewCanvas` 移除 `.pixel-frame` 边框装饰以产生更干净的视口。其内部工具栏（label + 缩放控制）保留。工具栏通过可选 snippet slot 变为可扩展的，工具可以在内置缩放/适配按钮旁注入额外控件（如网格开关）。
- 新增壳层组件 `FullStage`，作为最小化的全出血容器（`flex: 1; overflow: hidden`），供需要占据整个右侧面板区域的工具使用（WebGL 渲染器、视频舞台、全屏交互场景）。不提供缩放控制、工具栏或棋盘格——工具自行管理一切。
- 现有工具（`hello-world`、`aspect-ratio`、`three-cube`）迁移到新模式：`hello-world` 和 `aspect-ratio` 继续使用 `PreviewCanvas`；`three-cube` 切换到 `FullStage` 并直接渲染 canvas。
- 更新工具编写指南和框架架构文档以反映新的右侧面板契约。

## 能力

### 新增能力
- `right-panel-modes`：定义工具如何在不同的右侧面板渲染策略（PreviewCanvas、FullStage 或自由内容）之间选择的契约。

### 修改能力
- `tool-shell-workspace`：需求「工具渲染预览内容」变更——工具不再被强制渲染在「预览舞台」内部；它们自行选择右侧面板呈现模式。需求「预览舞台提供共享导航能力」变为有条件的——仅在工具主动选择 `PreviewCanvas` 时生效。

## 影响范围

- **组件**：`src/lib/components/shell/right-panel/RightPanel.svelte`、`src/lib/components/shell/preview-canvas/PreviewCanvas.svelte`、新增 `src/lib/components/shell/full-stage/FullStage.svelte` + `index.ts`
- **壳层导出**：`src/lib/components/shell/index.ts` 需重导出 `FullStage`
- **工具**：全部 3 个现有工具的 master 组件需要迁移编辑
- **文档**：`docs/tool-authoring-guide.md`、`docs/pixel-tool-framework-architecture.md`
- **规格**：`openspec/specs/tool-shell-workspace/spec.md` 需求更新
- **无新依赖**；壳层组件层以外无 API 变更
