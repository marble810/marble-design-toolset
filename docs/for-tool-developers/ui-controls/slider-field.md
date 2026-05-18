# SliderField 使用指南

## 适用范围

当 tool 的左侧面板需要数值参数控件时，统一使用共享 `SliderField` 原子组件，而不是裸 `<input type="number" class="pixel-input">`。

`SliderField` 将滑块轨道与数字输入框合并为一个复合控件，并支持"软限制"与"硬限制"的分层约束模型。

## 导入

```ts
import { SliderField } from '$lib/components/ui/slider-field/index.js';
```

## Props

| Prop | 类型 | 必填 | 描述 |
|---|---|---|---|
| `label` | `string` | ✓ | 显示在控件上方的标签文字 |
| `min` | `number` | ✓ | 滑块轨道的最小值（软限制） |
| `max` | `number` | ✓ | 滑块轨道的最大值（软限制） |
| `step` | `number` | — | 步进精度，默认 `1` |
| `value` | `number` | ✓ | 当前受控值 |
| `onchange` | `(value: number) => void` | ✓ | 值变更回调 |
| `hardMin` | `number` | — | 绝对最小值（硬限制，失焦时强制 clamp） |
| `hardMax` | `number` | — | 绝对最大值（硬限制，失焦时强制 clamp） |

## 软限制 vs. 硬限制

`SliderField` 实现了两级约束：

**软限制**（`min` / `max`）
- 决定滑块轨道的可视范围
- 用户在文本框中可以键入超出此范围的值
- 当值超出时，滑块拇指视觉上钉在端点，但实际值原样传出

**硬限制**（`hardMin` / `hardMax`，可选）
- 只在文本框失焦时触发 clamp
- 若值超出硬限制，自动修正至边界值，并通过 `onchange` 传出修正后的值
- 若不设置，用户可键入任意数值，失焦后不做 clamp

典型策略：**绝大多数参数只设软限制**；只有业务上不允许越界（如 Seed、Octaves）才额外设置 `hardMin`/`hardMax`。

## 基本用法

```svelte
<script lang="ts">
  import { SliderField } from '$lib/components/ui/slider-field/index.js';

  let scale = $state(4);
</script>

<SliderField
  label="Scale"
  min={0.5}
  max={18}
  step={0.1}
  value={scale}
  onchange={(v) => (scale = v)}
/>
```

## 带硬限制的用法

```svelte
<SliderField
  label="Seed"
  min={0}
  max={9999}
  step={1}
  hardMin={0}
  hardMax={9999}
  value={seed}
  onchange={(v) => (seed = Math.round(v))}
/>
```

> **注意**：整数参数（如 Seed、Octaves）应在 `onchange` 回调中手动调用 `Math.round()`，因为 `SliderField` 本身不强制输出类型为整数。

## 配合对象参数使用

当参数来自响应式状态对象时，可以直接传递并在回调中更新对应的 key：

```svelte
<SliderField
  label="Octaves"
  min={1}
  max={8}
  step={1}
  hardMin={1}
  hardMax={8}
  value={perlin.octaves}
  onchange={(v) => onPerlinChange('octaves', Math.round(v))}
/>
```

## 编辑行为

`SliderField` 内部维护一个 `editingValue` 草稿状态：

- 用户聚焦文本框时，外部 `value` prop 的变化不会覆盖正在输入的内容
- 用户失焦时，草稿被提交：执行硬限制 clamp（如有），将最终值通过 `onchange` 传出，然后内部状态与外部 value 同步

这保证了父组件频繁重渲时用户的键入不会被打断。

## 样式约定

- 组件宽度随外层容器自动撑满（`flex: 1 1 auto`）
- 文本框固定宽度 64 px；超过 5 位数的参数显示可能截断（后续可考虑 `inputWidth` prop 覆盖）
- 轨道与拇指样式遵循项目 CSS Custom Properties 和 `pixel-input` 体系，仅支持现代 Chromium

## 布局建议

在 tool 左侧面板中，通常用单列 grid 排列多个 `SliderField`：

```svelte
<div class="controls-grid">
  <SliderField label="Scale" ... />
  <SliderField label="Offset X" ... />
</div>

<style>
  .controls-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-3);
  }
</style>
```

> 不建议使用双列 grid 排列 `SliderField`，因为滑块轨道在较窄列宽下可用性较差。
