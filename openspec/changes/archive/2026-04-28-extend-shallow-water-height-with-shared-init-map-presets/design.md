## Context

当前 `shallow-water-height` 的 init map 构建路径完全绑定在工具内部：输入源只有单张本地图像，图像亮度经工具私有逻辑转换为高度初始状态。这样虽然能满足图像驱动工作流，但无法快速构造标准化波源，也无法让其他 tool 直接复用同一套可调节的程序化 init map。

同时，用户已经明确两个新的约束：一是浅水工具需要内建可调节的 init map 预设图形，二是该工具只保留视频导出，不再提供静态图像输出。这意味着变更不应仅停留在 `shallow-water-height` 私有组件层，而需要把“preset init map source”提升为共享运行时模块，并让浅水工具围绕该共享输入源重新组织 source panel 与 exporter 声明。

## Goals / Non-Goals

**Goals:**

- 提供一个共享的 preset init map source 运行时，可被任意 tool 直接导入并生成灰度 init map 栅格。
- 覆盖四类首版预设：圆形、方形、横条、竖条。
- 为圆形与方形提供 `fill` / `outline` 双模式，并支持可调的 outline width 与 feather。
- 统一预设参数语义，使位置、尺寸、outline width 和 feather 在不同输出分辨率下保持一致。
- 将 `shallow-water-height` 扩展为支持 preset source 的 init map 工作流，并在 preset 参数变化时稳定重建模拟。
- 将 `shallow-water-height` 的导出能力收敛为 video-only，同时继续使用 framework-owned canvas export runtime。

**Non-Goals:**

- 不在本次引入多图层叠加、多个预设同时混合、旋转形状、任意多边形或自定义曲线蒙版。
- 不把所有 tool 的输入面板统一重写为同一个共享 Svelte UI 组件。
- 不修改 framework 级 canvas export runtime、PreviewCanvas 或 file input pipeline 的契约。
- 不改变浅水工具当前的波动数值模型、吸收边界或预览尺寸策略。

## Decisions

### 1. 共享模块采用“运行时优先”的 preset source 设计

共享能力放在 `src/lib/runtime/` 下，而不是放在某个 tool 私有目录中。模块应由纯 TypeScript 参数类型、默认值、归一化逻辑和 raster 采样函数组成，使任何 tool 都能把它当成输入源直接消费，而不依赖浅水工具的组件结构。

选择这个方案的原因：

- “可供所有 Tools 直接调用为输入源”本质上是运行时复用需求，不是单一 UI 复用需求。
- 纯运行时模块可以同时服务于 WebGL tool、CPU tool、Pixi tool 或未来的导出离屏路径。
- 如果一开始就把共享能力做成浅水工具私有组件的抽取版，会把参数模型和 tool 交互细节耦合在一起，降低复用价值。

备选方案：直接在 `src/tools/shallow-water-height/` 内新增 preset 子模块，然后未来有其他 tool 再复制。放弃原因是这会把“共享输入源”退化成第二份私有实现。

### 2. 预设参数使用归一化坐标和尺寸，而不是像素单位

预设 shape 使用归一化参数表达：位置以 `[0, 1]` 空间中的中心点或轴向位置表示；尺寸以相对宽度、高度或半径表示；feather 使用与输出尺寸无关的归一化宽度表示。circle 与 square 额外拥有 `fill` / `outline` 模式，其中 `outline` 的宽度同样采用归一化语义。横条与竖条分别固定为铺满整张图的 width 或 height，只暴露其轴向位置、厚度与 feather。

选择这个方案的原因：

- 同一 preset descriptor 需要在 128、256、512 或其他尺寸下保持相同视觉语义。
- 共享模块服务多个 tool 时，不能把参数语义绑定到某个固定像素尺寸上。
- 对 UI 而言，归一化参数更容易做统一 slider 范围和跨工具默认值。
- outline width 一旦也使用归一化语义，就能在不同输出尺寸下保持一致的边框厚度含义。

备选方案：直接使用像素单位。放弃原因是不同 tool 输出尺寸一旦变化，就需要每个 tool 自己做尺寸换算，削弱共享模块价值。

### 3. circle / square 的 fill 与 outline 统一建模为同一个 shape family 的 mode 分支

circle 与 square 不拆成单独的 `circle-outline`、`square-outline` 预设，而是在各自 shape descriptor 下增加 `mode` 字段。`fill` 模式表示实心区域；`outline` 模式表示带有可调 outline width 的环形或框形区域，并继续共享同一组位置、尺寸和 feather 语义。

选择这个方案的原因：

- 从用户心智看，outline 不是新 shape，而是同一 shape 的一种绘制方式。
- 对共享 runtime 而言，把 mode 作为同一 family 的判别字段，更容易复用 circle / square 的距离场计算。
- 对 UI 而言，切换 fill / outline 时只需要增减少量 mode-specific 控件，而不是切换到另一整套 preset 类型。

备选方案：把 outline 变成独立 preset kind。放弃原因是这会复制 circle / square 的大部分参数定义，并让 preset 列表膨胀。

### 4. 共享模块直接输出确定性的灰度栅格缓冲，而不是 object URL 或 DOM 节点

共享 runtime 的核心输出应是一个按请求尺寸生成的灰度 buffer（例如 `Float32Array`，值域 `0..1`），由消费它的 tool 再决定如何上传到 WebGL、Pixi、2D canvas 或数值模拟初值。必要时可以在 tool 侧把该 buffer 转成纹理、canvas 或其他格式，但共享模块本身不拥有这些渲染细节。

选择这个方案的原因：

- 浅水工具当前需要的是可直接写入高度状态的数值栅格，而不是文件对象。
- 其他 tool 未来可能需要同一份灰度栅格去驱动遮罩、位移、噪声扰动或其他程序化输入。
- 共享模块保持与渲染后端解耦，才能避免为 Three/Pixi 各写一套版本。

备选方案：共享模块输出离屏 canvas 或 blob URL。放弃原因是那会强迫数值型 tool 再做一次像素回读，也让离屏导出路径变复杂。

### 5. `shallow-water-height` 采用显式 source mode：`image` 或 `preset`

浅水工具内部的 init map 输入源建模为判别联合：`image` 使用当前 file input pipeline；`preset` 使用共享 preset init map source。左侧 Source 区域需要先切换 source mode，再展示对应控件。每次 source mode、preset kind 或 preset 参数变化时，工具都从新的 init map 重新构建模拟状态，而不是在旧状态上做增量修改。

选择这个方案的原因：

- 当前工具已经有稳定的图像导入路径，保留它可避免无谓回退。
- source mode 显式切换可以避免把 file input 与 preset 参数混在同一组控件里，降低面板复杂度。
- init map 是模拟初值，任何结构性变化都应该触发完整重建，而不是尝试在已运行状态中热修补。

备选方案：只保留 preset source，完全移除图像导入。放弃原因是用户并未要求删除既有图像输入能力，而该能力对现有工作流仍有价值。

### 6. 导出改为 video-only，但继续使用 `render` exporter

`shallow-water-height` 的 metadata 改为只声明 `video: true`，不再声明 `image: true`。运行时继续注册 `kind: 'render'` exporter，但 capability 只暴露视频导出支持。这样 Export Section 会自然收敛到 Video tab，而不需要修改 framework 导出 UI 契约。

选择这个方案的原因：

- 用户要求非常明确：该工具不需要静态图像输出，只需要视频输出。
- 现有导出框架已经支持按 metadata 和 exporter capability 控制图片/视频可见性，无需框架级改造。
- `render` exporter 仍然是最适合浅水模拟的确定性视频导出路径。

备选方案：保留图片导出，把静态图像视为视频首帧的附带能力。放弃原因是这与用户收敛导出范围的要求相冲突。

## Risks / Trade-offs

- [单个 preset shape 可能不足以表达复杂波源] → 首版明确限制为单 shape 输入；若后续需要组合图形，再单独引入 layer/compositor 能力。
- [归一化 feather 在不同形状上的手感可能不完全一致] → 在实现时对 UI 文案和默认值做保守约束，并确保 circle/square/bar 的 feather 语义都落在“边缘软化宽度”上。
- [小尺寸 shape 的 outline width 与 feather 叠加后可能互相吞掉] → 归一化逻辑需要对 `outline width + feather` 与 shape 尺寸的关系做上限钳制，避免 outline 区域退化为不可见或全白。
- [同时保留 image 与 preset 两种输入源会增加左侧面板复杂度] → 使用显式 source mode 分组，把 file input 与 preset 参数分开渲染。
- [未来某些 tool 可能需要负值、高动态范围或多通道输入] → 首版共享模块只定义 `0..1` 灰度 init map；如有更复杂需求，再扩展 capability，而不是提前过度设计。

## Migration Plan

1. 新增共享 preset init map runtime，并确定参数类型、默认值和 raster 采样 API。
2. 将 `shallow-water-height` 的 source panel 重构为 `image` / `preset` 双模式，接入共享 runtime。
3. 调整浅水工具的 metadata 与 exporter capability，使 Export Section 只保留视频输出。
4. 验证 preset 参数变化会触发稳定重建，且现有图像输入路径不回归。

回滚策略：保留原有图像输入构建路径与 `render` exporter，只需移除新增 preset source 分支并恢复 image export 声明即可退回当前行为。

## Open Questions

- 当前无阻塞问题。若第二个 tool 很快需要同一套 preset 面板，再评估是否把控件 UI 一并抽成共享 Svelte 组件；首版先以共享运行时为主。