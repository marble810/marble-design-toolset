## Context

目前工具参数面板中的所有数值输入均使用裸 `<input type="number" class="pixel-input">`，其调节方式依赖浏览器原生 spin button（▲/▼ 点击或键盘方向键步进）。用户无法感知当前值在合理范围内的位置，大范围调参需要大量点击，体验较差。

需要新增共享 `SliderField` 复合组件，提供滑块 + 数字输入一体的交互模式，并支持"软限制"（slider 范围）与"硬限制"（绝对 clamp）的分层约束模型。

## Goals / Non-Goals

**Goals:**
- 新增 `SliderField` 共享 UI 原子组件，封装 slider 轨道 + 数字输入的复合交互
- 支持 `min`/`max` 作为 slider 可视范围（软限制），用户仍可键入超出范围的值
- 支持可选 `hardMin`/`hardMax`，在失焦时自动 clamp，绝对阻止超限值提交
- 将 `noise-texture-creater` 的全部数值控件迁移至 `SliderField`
- 组件样式遵循现有 `pixel-input` 与 CSS Custom Properties 体系

**Non-Goals:**
- 不引入第三方 slider 库（如 noUiSlider 等）
- 不处理多拇指（range）滑块场景
- 不为其他已有工具（aspect-ratio、hello-world）做迁移
- 不修改 `pixel-input` 全局 class 本身

## Decisions

### 1. 复合组件而非纯 Bits UI 包装

Bits UI 的显式推荐包装列表（Button、Dialog、DropdownMenu、Popover、Collapsible、Tabs）中不包含 Slider。`SliderField` 是一个"slider 轨道 + 数字文本输入"的复合控件，其交互逻辑由两个 HTML 原生元素协同实现，不需要 Bits UI 无障碍基础设施。因此采用手写复合组件，不包装 Bits UI。

### 2. HTML 原生 `<input type="range">` 作为滑块轨道

备选方案 A：纯 CSS + div 拖拽模拟轨道。工作量大，触摸/键盘兼容性差。  
备选方案 B：使用 `<input type="range">`。原生行为成熟，键盘可访问，只需 CSS 重写视觉样式。  
**选择 B**：配合 `appearance: none` 和 CSS Custom Properties 渲染像素风格轨道与拇指。

### 3. 软限制 vs. 硬限制的分层模型

- **软限制**（`min` / `max`）：滑块轨道的可视边界。range input 的 `min`/`max` 固定于此。用户在文本输入框键入的值若超出软限制，滑块视觉 clamp 到对应端点，但内部值原样保留并向上传递。
- **硬限制**（`hardMin` / `hardMax`，可选）：在文本输入 `blur` 时触发 clamp。若值超过硬限制则强制修正为边界值，并更新 UI 与 value。
- 若未指定 `hardMin`/`hardMax`，则无绝对限制，用户可自由键入任意数值。

### 4. 滑块与文本框双向同步

- 拖动 slider → 更新文本框显示，调用 `onchange`
- 文本框 `input` 事件 → 若解析为有效数值，更新 slider 显示（视觉 clamp），调用 `onchange`
- 文本框 `blur` 事件 → 执行硬限制 clamp（如有），修正显示值

### 5. 迁移策略

`NoiseControls.svelte` 中所有 `<label> + <input type="number">` 替换为 `<SliderField>`，`label` prop 替代外层 `<span class="noise-controls__caption">`。迁移完成后外层 `<label class="noise-controls__field">` 可去除。

## Risks / Trade-offs

- **Range input 样式跨浏览器一致性** → 仅需支持现代 Chromium（Electron/Chrome），使用 `-webkit-slider-*` 伪元素即可，可接受
- **文本框宽度固定** → slider 轨道占据主要水平空间，文本框给予固定宽度（如 64px），超过 5 位数的参数显示可能截断 → 后续可增加 `inputWidth` prop 覆盖
- **无受控 editing 态** → 用户正在键入时若父组件频繁重渲导致 value prop 变化，可能打断输入 → 使用内部 `editingValue` 草稿状态，仅在 `blur` 时同步父组件值

## Open Questions

（无）
