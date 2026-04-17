## 1. RightPanel 视觉基线

- [x] 1.1 为 RightPanel.svelte 的 `.right-panel` 样式块添加 `background: var(--color-bg-panel)`
- [x] 1.2 验证添加背景后现有工具正常渲染

## 2. PreviewCanvas 重构

- [x] 2.1 移除 PreviewCanvas 根 `<section>` 元素上的 `.pixel-frame` 类
- [x] 2.2 更新 PreviewCanvas 样式，去除 pixel-frame 边框，调整背景使边缘干净
- [x] 2.3 为 PreviewCanvas 的 Props 接口添加可选的 `actions` snippet prop
- [x] 2.4 在工具栏的缩放控制区域之后渲染 `actions` snippet
- [x] 2.5 验证 PreviewCanvas 工具栏在有/无自定义操作时均正确显示

## 3. FullStage 组件

- [x] 3.1 创建 `src/lib/components/shell/full-stage/FullStage.svelte`，实现最小化全出血容器（flex: 1、overflow: hidden、position: relative、min-width/min-height: 0）
- [x] 3.2 创建 `src/lib/components/shell/full-stage/index.ts` 桶导出
- [x] 3.3 在 `src/lib/components/shell/index.ts` 中添加 FullStage 导出

## 4. 工具迁移

- [x] 4.1 迁移 three-cube：将 `<PreviewCanvas>` 替换为 `<FullStage>`，在 FullStage 内直接渲染 `<CubeViewport />`
- [x] 4.2 更新 three-cube 导入语句（移除 PreviewCanvas，添加 FullStage）
- [x] 4.3 验证 hello-world 在更新后的 PreviewCanvas 下仍正确渲染（无需迁移，仅验证）
- [x] 4.4 验证 aspect-ratio 在更新后的 PreviewCanvas 下仍正确渲染（无需迁移，仅验证）

## 5. 文档更新

- [x] 5.1 更新 `docs/tool-authoring-guide.md`：将 PreviewCanvas 说明为可选项，介绍 FullStage 用法，更新模板示例
- [x] 5.2 更新 `docs/pixel-tool-framework-architecture.md`：更新 RightPanel/PreviewCanvas 描述，添加 FullStage 到组件层次结构
- [x] 5.3 更新框架架构 Mermaid 图，将 FullStage 显示为 PreviewCanvas 的同级节点

## 6. 验证

- [x] 6.1 执行 `npm run build` 确认零错误
- [x] 6.2 在浏览器中手动验证全部 3 个工具正确渲染
