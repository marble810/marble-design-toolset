## ADDED Requirements

### Requirement: 外置信息块不影响共享预览导航
当工具使用 PreviewCanvas 的外置信息块能力时，信息块 SHALL 保持与画布导航解耦。共享导航能力（Fit、1:1、显式缩放、滚轮缩放、拖拽平移）MUST 保持原有行为。

#### Scenario: 用户执行缩放与平移
- **WHEN** 用户在 viewport 中执行滚轮缩放或拖拽平移
- **THEN** 画布内容按既有规则变化，外置信息块保持贴合画布框右下锚点

#### Scenario: 工具启用外置信息块后继续使用共享导航
- **WHEN** 工具同时使用 PreviewCanvas 导航能力与外置信息块
- **THEN** Fit、1:1 与缩放百分比展示行为不发生回归

#### Scenario: 用户查看超长文本全文
- **WHEN** 用户 hover 外置信息块中的被截断行以查看 tooltip
- **THEN** 该行为不改变 PreviewCanvas 的缩放与平移状态

### Requirement: 外置信息块遵循框架级不可选策略
PreviewCanvas 的外置信息块区域 MUST 默认不可选中，以保持与预览区一致的交互体验。

#### Scenario: 用户在信息块区域拖拽或误选文本
- **WHEN** 用户在信息块区域执行拖拽或文本选择动作
- **THEN** 不应出现可见文本选区，且不破坏预览区交互体验

### Requirement: 外置信息块超限输入以静默裁剪保持稳定
当工具传入超限或不完整信息块数据时，PreviewCanvas MUST 以静默裁剪策略维持稳定渲染；工作区不得因该输入进入错误态。

#### Scenario: 工具输入超过 5 行
- **WHEN** 工具向外置信息块传入超过 5 行内容
- **THEN** 工作区继续正常渲染，且仅展示规则允许范围内的内容

#### Scenario: 工具传入不完整首行配置
- **WHEN** 工具传入不完整的首行模式数据
- **THEN** PreviewCanvas 进行容错裁剪并保持工作区可用
