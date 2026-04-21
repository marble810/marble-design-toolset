## MODIFIED Requirements

### Requirement: PreviewCanvas 是用于 2D 内容预览的可选壳层组件
PreviewCanvas SHALL 为固定尺寸的 2D 内容提供缩放/适配/平移控制、棋盘格视口，以及基于设备像素归一化缩放语义的 CSS transform 呈现。工具 MUST 在 RightPanel 内显式导入并渲染 PreviewCanvas 才能使用这些能力。PreviewCanvas MUST 接受可选的 `defaultZoom` prop，其值为 `Fit` 或 `1:1`，用于定义预览首次打开时的缩放模式。PreviewCanvas 在显示缩放百分比和解释 `1:1` 时 MUST 以“1 内容像素对应多少设备像素”为准，而不是直接把 CSS transform scale 当作用户可见缩放值。

#### Scenario: 工具选择 PreviewCanvas 进行 2D 预览
- **WHEN** 工具在 RightPanel 内渲染 PreviewCanvas，并传入 contentWidth 和 contentHeight
- **THEN** 预览视口以适配/缩放/平移控制和棋盘格背景显示工具内容

#### Scenario: 工具以 1:1 作为初始缩放模式打开预览
- **WHEN** 工具在 RightPanel 内渲染 PreviewCanvas，并传入 `defaultZoom="1:1"`
- **THEN** PreviewCanvas 在首帧按设备像素归一化后的 1:1 语义显示内容

#### Scenario: PreviewCanvas 渲染 raster 预览内容
- **WHEN** 工具在 PreviewCanvas 内渲染 `canvas`、`img` 或其他 raster surface
- **THEN** PreviewCanvas 提供像素化呈现基线，并且不把 renderer backing store 管理职责耦合进壳层组件

#### Scenario: 工具不使用 PreviewCanvas
- **WHEN** 工具在 RightPanel 内渲染内容但未使用 PreviewCanvas
- **THEN** 不应用缩放控制、棋盘格背景或 transform 缩放

## ADDED Requirements

### Requirement: PreviewCanvas 统一拥有外层预览边框样式
PreviewCanvas SHALL 为缩放内容表面提供统一的外层边框样式与内层压线表现。工具在 PreviewCanvas 内渲染子内容时 MUST NOT 在根预览元素上重复定义另一层默认外框，除非该工具明确需要嵌套画面或次级画框。

#### Scenario: 使用 PreviewCanvas 的 tool 提供普通预览内容
- **WHEN** 工具把常规预览内容挂进 PreviewCanvas
- **THEN** 外层画框由 PreviewCanvas 壳层统一渲染，而不是由工具自己的根预览元素定义