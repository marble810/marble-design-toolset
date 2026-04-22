# right-panel-modes Specification

## Purpose
定义工具如何在不同的右侧面板渲染策略（PreviewCanvas、FullStage 或自由内容）之间选择的契约。

## Requirements

### Requirement: RightPanel 提供视觉基线但不强制结构约束
RightPanel SHALL 渲染一个带 `background: var(--color-bg-panel)` 的 flex 容器，且不强制任何子组件结构要求。工具 MAY 在 RightPanel 内直接放置任意内容。

#### Scenario: 工具在 RightPanel 中渲染自由内容
- **WHEN** 工具在 RightPanel 内直接渲染自定义 HTML 元素，不使用 PreviewCanvas 或 FullStage
- **THEN** 内容出现在一个带面板背景色的 flex 容器中，且不存在工具栏、棋盘格或缩放控制

### Requirement: PreviewCanvas 是用于 2D 内容预览的可选壳层组件
PreviewCanvas SHALL 为固定尺寸的 2D 内容提供缩放/适配/平移控制、棋盘格视口，以及基于设备像素归一化缩放语义的 CSS transform 呈现。工具 MUST 在 RightPanel 内显式导入并渲染 PreviewCanvas 才能使用这些能力。PreviewCanvas MUST 接受可选的 `defaultZoom` prop，其值为 `Fit` 或 `1:1`，用于定义预览首次打开时的缩放模式。PreviewCanvas 在显示缩放百分比和解释 `1:1` 时 MUST 以“1 内容像素对应多少设备像素”为准，而不是直接把 CSS transform scale 当作用户可见缩放值。PreviewCanvas MUST 以视口中心作为内容定位参考点，再叠加缩放与平移变换，以保证不同内容尺寸在同一几何锚点下渲染。PreviewCanvas 内容区 MUST 默认禁止文本选择，防止预览导航过程中产生误选高亮。

#### Scenario: 工具选择 PreviewCanvas 进行 2D 预览
- **WHEN** 工具在 RightPanel 内渲染 PreviewCanvas，并传入 contentWidth 和 contentHeight
- **THEN** 预览视口以适配/缩放/平移控制和棋盘格背景显示工具内容

#### Scenario: 工具以 1:1 作为初始缩放模式打开预览
- **WHEN** 工具在 RightPanel 内渲染 PreviewCanvas，并传入 `defaultZoom="1:1"`
- **THEN** PreviewCanvas 在首帧按设备像素归一化后的 1:1 语义显示内容

#### Scenario: 大尺寸内容进入 PreviewCanvas
- **WHEN** 工具传入明显大于当前视口可用空间的固定尺寸内容
- **THEN** PreviewCanvas 仍以视口中心作为初始参考点渲染内容，而不是以左上起点布局后再缩放

#### Scenario: PreviewCanvas 渲染 raster 预览内容
- **WHEN** 工具在 PreviewCanvas 内渲染 `canvas`、`img` 或其他 raster surface
- **THEN** PreviewCanvas 提供像素化呈现基线，并且不把 renderer backing store 管理职责耦合进壳层组件

#### Scenario: 用户在预览区执行导航交互
- **WHEN** 用户在 PreviewCanvas 中拖拽平移或滚轮缩放
- **THEN** 内容更新平移或缩放状态，且不进入文本选择高亮状态

#### Scenario: 工具不使用 PreviewCanvas
- **WHEN** 工具在 RightPanel 内渲染内容但未使用 PreviewCanvas
- **THEN** 不应用缩放控制、棋盘格背景或 transform 缩放

### Requirement: PreviewCanvas 不使用 pixel-frame 边框装饰
PreviewCanvas SHALL NOT 应用 `.pixel-frame` border-image 装饰。组件 MUST 以干净的边缘渲染，与 RightPanel 背景融合。

#### Scenario: PreviewCanvas 视觉融合
- **WHEN** PreviewCanvas 在 RightPanel 中渲染
- **THEN** PreviewCanvas 容器上不显示 border-image 或外层像素边框

### Requirement: PreviewCanvas 统一拥有外层预览边框样式
PreviewCanvas SHALL 为缩放内容表面提供统一的外层边框样式与内层压线表现。工具在 PreviewCanvas 内渲染子内容时 MUST NOT 在根预览元素上重复定义另一层默认外框，除非该工具明确需要嵌套画面或次级画框。

#### Scenario: 使用 PreviewCanvas 的 tool 提供普通预览内容
- **WHEN** 工具把常规预览内容挂进 PreviewCanvas
- **THEN** 外层画框由 PreviewCanvas 壳层统一渲染，而不是由工具自己的根预览元素定义

### Requirement: PreviewCanvas 工具栏支持通过 snippet slot 添加自定义操作
PreviewCanvas SHALL 接受可选的 `actions` snippet prop，在工具栏区域的内置缩放/适配按钮之后渲染额外控件。

#### Scenario: 工具添加自定义工具栏操作
- **WHEN** 工具向 PreviewCanvas 传递 actions snippet
- **THEN** 自定义操作在缩放控制之后渲染在工具栏中

#### Scenario: 未提供自定义操作
- **WHEN** 工具使用 PreviewCanvas 但不传递 actions snippet
- **THEN** 工具栏仅渲染默认的标签、缩放百分比和缩放/适配控制

### Requirement: PreviewCanvas 提供画布外右下信息块区域
PreviewCanvas SHALL 提供一个可选的外置信息块区域。该区域 MUST 渲染在画布内容框之外，并锚定到当前画布框的右下侧；其位置 MUST 跟随画布平移与缩放后的框体几何变化。

#### Scenario: 工具提供外置信息块
- **WHEN** 工具向 PreviewCanvas 提供信息块内容
- **THEN** 信息块渲染在画布框外右下区域，并与画布框保持锚定关系

#### Scenario: 画布框发生平移或缩放
- **WHEN** 用户对画布执行拖拽平移或缩放
- **THEN** 信息块位置随画布框右下锚点同步变化

#### Scenario: 工具未提供外置信息块
- **WHEN** 工具未提供信息块内容
- **THEN** PreviewCanvas 不渲染该信息块区域，现有布局行为保持不变

### Requirement: 信息块内容结构采用首行三模式与正文文本行
PreviewCanvas SHALL 将信息块内容限制为最多 5 行。首行 MUST 支持且仅支持 `IconOnly`、`IconAndTitle`、`TitleOnly` 三种模式；第 2 行到第 5 行 MUST 仅允许文本内容。

#### Scenario: 信息块内容超出行数上限
- **WHEN** 工具提供超过 5 行的信息块内容
- **THEN** PreviewCanvas 仅渲染前 5 行，超出行丢弃

#### Scenario: 首行模式受限
- **WHEN** 工具提供首行信息
- **THEN** 首行仅以 IconOnly、IconAndTitle 或 TitleOnly 之一渲染

#### Scenario: 正文行仅允许文本
- **WHEN** 工具提供第 2 至第 5 行内容
- **THEN** 这些行均以纯文本行渲染

#### Scenario: 信息块渲染节点类型受控
- **WHEN** PreviewCanvas 渲染信息块
- **THEN** 该区域内用于内容表达的节点仅由 div、p 与 PixelIcon 组成

### Requirement: 信息块采用固定宽度与溢出全文查看规则
PreviewCanvas MUST 以固定宽度 `20em` 渲染外置信息块。每行内容 MUST 以单行方式渲染；超出可视宽度时 MUST 以省略号展示，并在 hover 或 focus 时提供全文 tooltip。

#### Scenario: 行内容超出固定宽度
- **WHEN** 任一信息行文本超出 20em 可视宽度
- **THEN** 该行以省略号显示被截断部分

#### Scenario: 用户查看被截断行全文
- **WHEN** 用户将指针悬停在被截断的信息行，或通过键盘 focus 到该行
- **THEN** 系统显示该行完整文本的 tooltip

### Requirement: 信息块输入通过 helper 构造并静默裁剪
PreviewCanvas SHALL 提供 helper 形式的输入构造方式，供工具声明信息块内容。对于超出结构或容量约束的输入，组件 MUST 执行静默裁剪并保持稳定渲染，不输出运行时告警或错误。

#### Scenario: 工具使用 helper 构造信息块
- **WHEN** 工具按框架提供的 helper 组织信息块内容
- **THEN** PreviewCanvas 正常渲染外置信息块

#### Scenario: 输入超出规则
- **WHEN** 工具输入不满足行数或结构约束
- **THEN** PreviewCanvas 以静默裁剪方式降级渲染，且不抛出运行时错误

### Requirement: FullStage 提供最小化全出血容器
FullStage SHALL 是手写壳层组件，提供一个填满整个 RightPanel 区域的全出血容器。它 MUST 设置 `flex: 1`、`overflow: hidden` 和 `position: relative`。它 SHALL NOT 提供缩放控制、工具栏或背景装饰。

#### Scenario: WebGL 工具使用 FullStage
- **WHEN** 工具在 FullStage 内渲染 WebGL canvas
- **THEN** canvas 元素可填满整个可用区域并自行管理视口尺寸

#### Scenario: FullStage 不施加视觉装饰
- **WHEN** FullStage 在 RightPanel 中渲染
- **THEN** 不存在工具栏、棋盘格、缩放控制或边框装饰——仅可见工具自己的内容

### Requirement: 壳层 index 导出所有右侧面板容器组件
壳层组件桶导出（`src/lib/components/shell/index.ts`）SHALL 导出 PreviewCanvas、FullStage 和 RightPanel，使工具可以从单一路径导入任意组合。

#### Scenario: 工具从壳层 index 导入 FullStage
- **WHEN** 工具文件从 `$lib/components/shell/index.js` 导入 `{ FullStage }`
- **THEN** 导入正确解析到 FullStage 组件且无错误
