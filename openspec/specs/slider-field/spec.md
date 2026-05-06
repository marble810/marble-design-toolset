# slider-field Specification

## Purpose
定义共享 SliderField 组件的滑块、数值输入、软硬限制与编辑草稿同步语义，供工具左侧面板复用。

## Requirements

### Requirement: SliderField 提供滑块与数值输入的复合交互

工作区 SHALL 提供共享 `SliderField` UI 原子组件，将 slider 轨道与数字文本输入框组合为单一复合控件，供所有 tool 左侧面板的数值参数使用。

#### Scenario: 渲染带标签的滑块控件
- **WHEN** 消费方传入 `label`、`min`、`max`、`step`、`value`、`onchange` 给 `SliderField`
- **THEN** 组件渲染一行包含标签文字、滑块轨道和数字输入框的复合控件

#### Scenario: 拖动滑块更新数值
- **WHEN** 用户拖动 slider 拇指到新位置
- **THEN** 数字输入框显示该位置对应的精确数值，并调用 `onchange` 传出该数值

#### Scenario: 键入值在软限制范围内
- **WHEN** 用户在数字输入框中键入一个在 `[min, max]` 范围内的数值
- **THEN** 滑块拇指同步移动到对应位置，并调用 `onchange` 传出该数值

### Requirement: SliderField 支持软限制与硬限制分层约束

`SliderField` SHALL 实现软限制（`min`/`max`）与硬限制（`hardMin`/`hardMax`）的分层约束模型：软限制约束滑块可视范围但允许键入超出；硬限制在提交时强制 clamp。

#### Scenario: 键入值超出软限制（无硬限制）
- **WHEN** 用户在数字输入框中键入一个超出 `min`/`max` 范围的值，且未设置 `hardMin`/`hardMax`
- **THEN** 滑块拇指视觉上 clamp 至对应端点，但实际值原样保留并调用 `onchange` 传出

#### Scenario: 键入值超出硬限制
- **WHEN** 用户在数字输入框中键入一个超出 `hardMin`/`hardMax` 的值，并使输入框失焦
- **THEN** 值被自动 clamp 至对应硬限制边界，输入框显示修正后的值，并调用 `onchange` 传出修正值

#### Scenario: 未设置硬限制时无绝对极限
- **WHEN** `hardMin` 和 `hardMax` 均未传入
- **THEN** 用户可键入任意有效数字，失焦后不执行 clamp，值原样传出

#### Scenario: 滑块拖动不超出软限制
- **WHEN** 用户拖动 slider 拇指
- **THEN** 滑块拇指的值严格限制在 `[min, max]` 范围内，不会超出滑块轨道边界

### Requirement: SliderField 编辑过程中不被外部 value 变化打断

`SliderField` SHALL 维护内部编辑草稿状态，确保用户正在键入时不被父组件的 value 更新覆盖输入框内容。

#### Scenario: 用户正在编辑输入框
- **WHEN** 用户已聚焦数字输入框并正在键入
- **THEN** 即使父组件的 `value` prop 发生变化，输入框内容不被重置，用户键入不中断

#### Scenario: 用户完成编辑（失焦）
- **WHEN** 用户使数字输入框失焦
- **THEN** 编辑草稿被提交（含硬限制 clamp），内部状态与外部 value 同步
