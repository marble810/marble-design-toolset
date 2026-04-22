## Why

PreviewCanvas 在内容尺寸明显大于视口时会出现初始定位偏移，缩放与模式切换后视觉上表现为画面始终向右下方向偏移，导致核心预览区域难以稳定对齐。与此同时，预览区内文本当前可被选中，会在拖拽平移或高频缩放操作中产生误选高亮，破坏通用预览交互的一致性。

## What Changes

- 调整 PreviewCanvas 的内容定位模型，使固定尺寸内容在进入缩放流程前就以视口中心为参考定位，避免大尺寸内容在左上起点布局后再被裁切造成的锚点错觉。
- 将 PreviewCanvas 缩放与平移的合成变换改为以中心定位为基线，确保 Fit、1:1 与手动缩放在同一几何参考系下表现一致。
- 在框架层对 PreviewCanvas 内容区建立统一不可选文本策略，默认阻止预览内容被选中，减少拖拽平移与缩放过程中的误选。
- 明确 PreviewCanvas 的交互边界：框架负责通用中心定位、缩放/平移与选择限制，工具无需为同类行为重复补丁。

## Capabilities

### New Capabilities

### Modified Capabilities
- `right-panel-modes`: PreviewCanvas 的中心定位语义与内容交互策略更新，新增框架级文本不可选约束。
- `tool-shell-workspace`: 共享预览导航能力补充“中心对齐优先”与“导航过程不触发文本选择”的行为要求。

## Impact

- Affected component: `src/lib/components/shell/preview-canvas/PreviewCanvas.svelte`
- Potentially affected styles: `src/lib/components/shell/preview-canvas/PreviewCanvas.svelte` 内样式块
- Affected specs: `openspec/specs/right-panel-modes/spec.md`, `openspec/specs/tool-shell-workspace/spec.md`
- Existing PreviewCanvas consumers 无需额外传参即可获得修复；若个别工具依赖可选中文本行为，需要在工具内部显式覆盖
- No new runtime dependencies and no new panel container types