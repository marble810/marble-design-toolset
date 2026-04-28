## Why

当前所有数值参数控件均使用浏览器原生 `<input type="number">` spin button，每次只能点击 ▲/▼ 步进，缺乏可视化范围感知，调节效率低下。将其升级为带有自定义滑块范围、可键入超出范围值、以及可选 hard-limit 的 SliderField 组件，将大幅提升工具的调参体验和易用性。

## What Changes

- 新增共享 `SliderField` UI 原子组件（`src/lib/components/ui/slider-field/`），替代当前各 tool 自行使用的裸 `<input type="number">`
- 组件 API 支持：
  - `min` / `max`：滑块轨道的可视范围（用户可键入超出此范围的值）
  - `hardMin` / `hardMax`（可选）：直接输入也无法突破的绝对极限，键入后自动 clamp
  - `step`：步进精度
  - `value` / `onchange`：受控值绑定
  - `label`：字段标签（取代外层 `<label>` 样板）
- 将 `noise-texture-creater` 工具的所有数值控件迁移至 `SliderField`，作为首个使用示例
- 原有裸 `<input type="number" class="pixel-input">` 模式在各 tool 中被废弃

## Capabilities

### New Capabilities

- `slider-field`: 共享 SliderField UI 原子组件——具备可视滑块轨道、键入超出 slider 范围、可选 hard-limit clamp 的数值输入复合控件

### Modified Capabilities

（无现有 spec 级行为变更）

## Impact

- `src/lib/components/ui/slider-field/SliderField.svelte`（新建）
- `src/lib/components/ui/slider-field/index.ts`（新建）
- `src/lib/components/ui/index.ts`（新增导出）
- `src/tools/noise-texture-creater/components/NoiseControls.svelte`（迁移至 SliderField）
- 无外部依赖新增；滑块轨道使用手写 CSS + HTML range input 实现，不引入第三方 slider 库
