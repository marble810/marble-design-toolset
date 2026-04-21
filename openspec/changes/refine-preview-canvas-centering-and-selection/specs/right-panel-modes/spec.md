## MODIFIED Requirements

### Requirement: PreviewCanvas 是用于 2D 内容预览的可选壳层组件
PreviewCanvas SHALL 为固定尺寸的 2D 内容提供缩放/适配/平移控制、棋盘格视口和基于 CSS transform 的缩放。工具 MUST 在 RightPanel 内显式导入并渲染 PreviewCanvas 才能使用这些能力。PreviewCanvas MUST 以视口中心作为内容定位参考点，再叠加缩放与平移变换，以保证不同内容尺寸在同一几何锚点下渲染。PreviewCanvas 内容区 MUST 默认禁止文本选择，防止预览导航过程中产生误选高亮。

#### Scenario: 工具选择 PreviewCanvas 进行 2D 预览
- **WHEN** 工具在 RightPanel 内渲染 PreviewCanvas，并传入 contentWidth 和 contentHeight
- **THEN** 预览视口以适配/缩放/平移控制和棋盘格背景显示工具内容

#### Scenario: 大尺寸内容进入 PreviewCanvas
- **WHEN** 工具传入明显大于当前视口可用空间的固定尺寸内容
- **THEN** PreviewCanvas 仍以视口中心作为初始参考点渲染内容，而不是以左上起点布局后再缩放

#### Scenario: 用户在预览区执行导航交互
- **WHEN** 用户在 PreviewCanvas 中拖拽平移或滚轮缩放
- **THEN** 内容更新平移或缩放状态，且不进入文本选择高亮状态

#### Scenario: 工具不使用 PreviewCanvas
- **WHEN** 工具在 RightPanel 内渲染内容但未使用 PreviewCanvas
- **THEN** 不应用缩放控制、棋盘格背景或 transform 缩放