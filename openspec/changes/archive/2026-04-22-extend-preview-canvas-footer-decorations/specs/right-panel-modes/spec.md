## ADDED Requirements

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
PreviewCanvas MUST 以固定宽度 `20em` 渲染外置信息块。每行内容 MUST 以单行方式渲染；超出可视宽度时 MUST 以省略号展示，并在 hover 时提供全文 tooltip。

#### Scenario: 行内容超出固定宽度
- **WHEN** 任一信息行文本超出 20em 可视宽度
- **THEN** 该行以省略号显示被截断部分

#### Scenario: 用户 hover 被截断行
- **WHEN** 用户将指针悬停在被截断的信息行
- **THEN** 系统显示该行完整文本的 tooltip

### Requirement: 信息块输入通过 helper 构造并静默裁剪
PreviewCanvas SHALL 提供 helper 形式的输入构造方式，供工具声明信息块内容。对于超出结构或容量约束的输入，组件 MUST 执行静默裁剪并保持稳定渲染，不输出运行时告警或错误。

#### Scenario: 工具使用 helper 构造信息块
- **WHEN** 工具按框架提供的 helper 组织信息块内容
- **THEN** PreviewCanvas 正常渲染外置信息块

#### Scenario: 输入超出规则
- **WHEN** 工具输入不满足行数或结构约束
- **THEN** PreviewCanvas 以静默裁剪方式降级渲染，且不抛出运行时错误
