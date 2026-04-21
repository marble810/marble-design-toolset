## MODIFIED Requirements

### Requirement: 预览舞台提供共享导航能力
当工具选择使用 PreviewCanvas 时，PreviewCanvas SHALL 提供棋盘格背景、Fit 模式、1:1 模式、显式缩放控件、缩放百分比显示、拖拽平移和滚轮缩放能力。此能力仅在工具主动选择 PreviewCanvas 时生效。PreviewCanvas 对外显示的缩放百分比 MUST 表示设备像素归一化后的 logical zoom；当浏览器缩放或 `devicePixelRatio` 变化时，处于手动缩放状态的 PreviewCanvas MUST 保持当前 logical zoom 不变，并通过内部 render scale 调整继续表达同一用户可见缩放语义。处于 Fit 模式时，PreviewCanvas MAY 基于新的可用视口尺寸重新计算 fit zoom。

#### Scenario: 用户切换到 Fit 模式
- **WHEN** 用户在使用 PreviewCanvas 的工具中激活 Fit 控件
- **THEN** 预览舞台把当前预览缩放到可用视口范围内的最佳适配尺寸，并以设备像素归一化后的 logical zoom 表示该结果

#### Scenario: 用户请求实际尺寸预览
- **WHEN** 用户在使用 PreviewCanvas 的工具中激活 1:1 控件
- **THEN** 预览舞台按设备像素归一化后的实际比例显示内容

#### Scenario: 用户手动浏览预览内容
- **WHEN** 用户在使用 PreviewCanvas 的工具中拖拽预览区域或通过滚轮进行缩放
- **THEN** 预览舞台更新平移或 logical zoom 状态，而不要求工具自行实现这类通用导航逻辑

#### Scenario: 手动缩放状态下浏览器缩放或 DPR 发生变化
- **WHEN** 使用 PreviewCanvas 的工具当前处于手动缩放状态，并在当前会话中遇到浏览器缩放变化或 `devicePixelRatio` 变化
- **THEN** 预览舞台保持当前 logical zoom 百分比不变，并重新计算内部 render scale 来维持同一用户可见缩放语义

#### Scenario: 工具不使用 PreviewCanvas
- **WHEN** 工具选择使用 FullStage 或自定义内容填充 RightPanel
- **THEN** 不提供共享的缩放/平移/适配导航 — 工具自行管理全部交互