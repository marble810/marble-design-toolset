## 1. 新建 SliderField 组件

- [ ] 1.1 创建 `src/lib/components/ui/slider-field/SliderField.svelte`，接受 `label`、`min`、`max`、`step`、`value`、`onchange`、`hardMin?`、`hardMax?` props
- [ ] 1.2 在组件内实现内部编辑草稿状态（`editingValue`），聚焦时锁定外部 value 更新，失焦时提交并同步
- [ ] 1.3 实现滑块拖动逻辑：range input 的 `oninput` → 更新数值，调用 `onchange`
- [ ] 1.4 实现文本框键入逻辑：`oninput` → 解析有效数字 → 更新滑块视觉位置（视觉 clamp 至 `[min, max]`）→ 调用 `onchange` 传出未 clamp 的原始值
- [ ] 1.5 实现失焦硬限制 clamp：`onblur` → 若 `hardMin`/`hardMax` 存在且值超限，修正值并调用 `onchange`
- [ ] 1.6 用 CSS Custom Properties 和 `appearance: none` 为 range input 书写像素风格轨道与拇指样式，与现有 `pixel-input` 风格一致
- [ ] 1.7 创建 `src/lib/components/ui/slider-field/index.ts`，导出 `SliderField`

## 2. 注册到共享 UI 导出

- [ ] 2.1 在 `src/lib/components/ui/index.ts` 中新增 `export * from './slider-field/index.js'`

## 3. 迁移 noise-texture-creater 控件

- [ ] 3.1 在 `NoiseControls.svelte` 中引入 `SliderField`
- [ ] 3.2 将 Shared Parameters 区块的 6 个 `<label>+<input type="number">` 替换为 `SliderField`（Seed、Scale、Offset X、Offset Y、Brightness、Contrast），为各参数设置合理的 `min`/`max`/`step`，Seed 设置 `hardMin=0` `hardMax=9999`
- [ ] 3.3 将 Perlin Parameters 区块的 4 个控件替换为 `SliderField`（Octaves、Persistence、Lacunarity、Exponent），Octaves 设置 `hardMin=1` `hardMax=8`
- [ ] 3.4 将 Voronoi Parameters 区块的数值控件替换为 `SliderField`
- [ ] 3.5 移除 `NoiseControls.svelte` 中已不再使用的 `readNumber`/`readInteger` helper 函数及裸 `pixel-input` 相关样式

## 4. 验证

- [ ] 4.1 在浏览器中打开 noise-texture-creater 工具，确认所有参数控件均显示为滑块 + 数字输入框的复合形态
- [ ] 4.2 验证拖动滑块、键入范围内值、键入超出软限制值（滑块钉在端点但值传出）、键入超出硬限制并失焦（值被 clamp）均正常工作
- [ ] 4.3 运行 `npm run build` 确认无编译错误
