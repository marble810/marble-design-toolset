# pixel-ui-foundation Specification

## Purpose
TBD - created by archiving change establish-pixel-tool-framework. Update Purpose after archive.
## Requirements
### Requirement: 共享像素设计令牌
工作区 SHALL 在全局 CSS Custom Properties 中定义共享设计令牌基础，覆盖颜色、间距、排版、边框、动效和分层表面。工作区壳层使用的共享间距与排版令牌 SHALL 使用基于像素的单位。

#### Scenario: 壳层样式通过全局令牌获取共享值
- **WHEN** 某个壳层组件需要背景、边框、间距或字号
- **THEN** 它使用共享 CSS Custom Property，而不是为这些共享关注点写死组件内部的常量值

#### Scenario: 壳层间距保持像素对齐
- **WHEN** 工作区壳层布局使用间距或文字尺寸令牌
- **THEN** 这些令牌值使用 `px` 表达

### Requirement: 交互原子组件使用 Bits UI 包装层
工作区 SHALL 将可复用的交互原子组件实现为基于 Bits UI primitive 的项目级包装组件，同时保留布局型结构由项目手写实现。

#### Scenario: 引入一个交互原子组件
- **WHEN** 仓库新增可复用的按钮、对话框、下拉菜单、折叠区域、弹出层或标签页原子组件
- **THEN** 该实现基于对应的 Bits UI primitive，而不是重新手写交互逻辑

#### Scenario: 引入一个布局原子组件
- **WHEN** 仓库新增 panel、section 或 preview container 这类壳层布局组件
- **THEN** 该组件作为手写布局组件实现，而不是 Bits UI primitive 包装层

### Requirement: Bits UI 组合规则必须被保留
Bits UI 包装层和其消费者 SHALL 保留必要的 child-snippet 行为，包括委托元素上的 props 透传，以及浮动内容的双层 wrapper 结构。

#### Scenario: 浮动类 Bits UI 表面使用自定义渲染
- **WHEN** 下拉菜单、popover、dialog overlay 或类似浮动表面使用 `child` snippet
- **THEN** 外层 wrapper 接收 `wrapperProps` 且不承载视觉样式，内层内容元素接收 `props`

#### Scenario: 委托 trigger 或内容元素时进行自定义
- **WHEN** 某个 Bits UI primitive 通过委托 child 元素渲染
- **THEN** 被委托的元素接收完整展开的 Bits UI `props`

### Requirement: 像素资源策略被统一标准化
工作区 SHALL 通过共享图标包装组件使用 raw SVG 像素图标，并且 SHALL 使用共享 SVG border-image 资源来呈现像素边框。

#### Scenario: 渲染一个共享图标
- **WHEN** 壳层或 UI primitive 需要渲染可复用图标
- **THEN** 它通过共享图标组件渲染 raw SVG 像素图标

#### Scenario: 共享壳层容器使用像素边框系统
- **WHEN** 某个可复用壳层组件或 UI 组件应用项目边框风格
- **THEN** 它引用共享 SVG border-image 资源，而不是在组件内部嵌入独立的位图边框

### Requirement: 工作区执行桌面型视口约束
工作区 SHALL 作为纯横屏应用运行，并且 SHALL 在宽度小于 720px 时以黑屏和英文提示的方式阻止正常工作区界面显示。

#### Scenario: 视口宽度低于支持下限
- **WHEN** 当前渲染视口宽度小于 720px
- **THEN** 正常工作区 UI 被抑制，用户看到黑色背景与英文最小宽度提示

#### Scenario: 当前设计阶段编写壳层文案与响应式规则
- **WHEN** 为壳层编写共享 UI 文案或响应式规则
- **THEN** 文案使用英文，并且不引入竖屏专用布局模式

### Requirement: 仓库级指导文件记录 UI 基础规则
仓库 SHALL 提供面向 AI 与贡献者的指导文件，记录 Bits UI 基线、仅英文文案、纯横屏约束和像素单位样式规则。

#### Scenario: 贡献者或 AI 助手需要工作区 UI 约束
- **WHEN** 在组件生成或修改阶段查阅仓库指令文件
- **THEN** 文件中包含已确认的 Bits UI 与工作区基础规则

