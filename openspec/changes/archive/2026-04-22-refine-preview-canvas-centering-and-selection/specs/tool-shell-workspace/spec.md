## MODIFIED Requirements

### Requirement: 预览舞台提供共享导航能力
当工具选择使用 PreviewCanvas 时，PreviewCanvas SHALL 提供棋盘格背景、Fit 模式、1:1 模式、显式缩放控件、缩放百分比显示、拖拽平移和滚轮缩放能力。此能力仅在工具主动选择 PreviewCanvas 时生效。PreviewCanvas MUST 以统一中心锚点处理内容定位，使 Fit、1:1 与手动缩放共享一致的几何参考。PreviewCanvas 在导航交互期间 MUST 避免文本被选中。

#### Scenario: 用户切换到 Fit 模式
- **WHEN** 用户在使用 PreviewCanvas 的工具中激活 Fit 控件
- **THEN** 预览舞台把当前预览缩放到可用视口范围内的最佳适配尺寸，并维持中心锚点

#### Scenario: 用户请求实际尺寸预览
- **WHEN** 用户在使用 PreviewCanvas 的工具中激活 1:1 控件
- **THEN** 预览舞台按预览逻辑内容的实际比例显示内容，并维持中心锚点

#### Scenario: 用户手动浏览预览内容
- **WHEN** 用户在使用 PreviewCanvas 的工具中拖拽预览区域或通过滚轮进行缩放
- **THEN** 预览舞台更新平移或缩放状态，而不要求工具自行实现这类通用导航逻辑
- **THEN** 预览区不会触发文本选择高亮

#### Scenario: 工具不使用 PreviewCanvas
- **WHEN** 工具选择使用 FullStage 或自定义内容填充 RightPanel
- **THEN** 不提供共享的缩放/平移/适配导航 — 工具自行管理全部交互