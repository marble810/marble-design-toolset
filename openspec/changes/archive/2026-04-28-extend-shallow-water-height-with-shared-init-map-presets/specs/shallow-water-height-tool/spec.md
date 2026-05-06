## ADDED Requirements

### Requirement: Tool module is registered as a Three.js height animation tool with video-only export
系统 SHALL 提供 `shallow-water-height` 工具模块，工具 SHALL 继续遵循 `src/tools/<tool-id>/` schema，并通过共享 tech stack runtime 加载 `three`。该工具的 metadata MUST 只声明视频导出能力，MUST NOT 声明静态图片导出能力。

#### Scenario: Tool appears in workspace catalog
- **WHEN** 工作区发现 `src/tools/shallow-water-height/metadata.json`
- **THEN** 工具目录中出现名为 `Shallow Water Height` 的可用工具
- **THEN** 打开工具时工作区通过共享 tech stack runtime 加载 `three`

#### Scenario: Export section reflects video-only capability
- **WHEN** 用户打开浅水工具的 Export Section
- **THEN** 该工具只暴露视频导出入口
- **THEN** 不显示 PNG 或其他静态图像导出入口

### Requirement: Tool accepts either an imported grayscale image or a shared preset init map source
系统 SHALL 允许 `shallow-water-height` 在两类 init map 来源之间切换：单张本地图像，以及共享 preset init map source。工具在任一来源发生结构性变化时 MUST 重建模拟初始状态，并在导入失败时保留最近一次成功的 init map。

#### Scenario: User imports a valid image source
- **WHEN** 用户通过 file input pipeline 选择或拖放一张受支持图像
- **THEN** 工具读取标准化 image input item 的对象 URL 与尺寸
- **THEN** 工具从图像亮度生成 init map，并重建模拟状态

#### Scenario: User selects a preset source
- **WHEN** 用户把 init map source mode 切换到共享 preset source 并选择一个受支持的 preset
- **THEN** 工具使用共享 preset runtime 生成灰度 init map
- **THEN** 工具用该 init map 重建模拟状态，而不是继续沿用旧输入源的状态

#### Scenario: User imports an invalid file while image mode is active
- **WHEN** 用户提交非图像文件或一次提交多个文件
- **THEN** 工具显示 file input runtime 提供的稳定错误状态
- **THEN** 工具继续保留最近一次成功的 init map

### Requirement: Tool exposes preset controls for circle, square, horizontal bar, and vertical bar
当 `shallow-water-height` 使用 preset init map source 时，工具 SHALL 暴露对 `circle`、`square`、`horizontal-bar` 和 `vertical-bar` 的选择与参数控制。circle 与 square MUST 支持 `fill` / `outline` 模式、位置、尺寸和 feather；当 mode 为 `outline` 时，工具 MUST 额外暴露 outline width 控件。horizontal-bar 与 vertical-bar MUST 支持位置、厚度和 feather。

#### Scenario: User switches between preset kinds
- **WHEN** 用户在 preset source 下切换不同 preset kind
- **THEN** 工具更新当前可见参数控件，使其与被选中的 preset kind 对应
- **THEN** 工具使用新 preset kind 重新生成 init map

#### Scenario: User switches fill and outline modes for circle or square
- **WHEN** 用户在 `circle` 或 `square` preset 下把 mode 从 `fill` 切换到 `outline`，或从 `outline` 切换回 `fill`
- **THEN** 工具更新当前可见参数控件以匹配该 mode
- **THEN** `outline` mode 下显示可调的 outline width 控件，而 `fill` mode 下不显示该控件

#### Scenario: User adjusts preset parameters
- **WHEN** 用户调整 preset 的位置、尺寸、outline width 或 feather 参数
- **THEN** 工具重新生成 init map 并重建浅水模拟初值
- **THEN** 预览结果反映新的 preset 形状与边缘软化效果

### Requirement: Simulation uses damped linear shallow-water height propagation
系统 SHALL 使用线性浅水波/高度场模型推进动画状态。每个模拟步 MUST 根据当前高度、上一帧高度、邻域 Laplacian、波速和阻尼计算下一高度，并 MUST 将数值参数限制在稳定范围内。

#### Scenario: Simulation advances from the selected init map source
- **WHEN** 用户提供任一有效 init map 来源并启动预览
- **THEN** 初始亮度分布作为高度扰动向周围传播
- **THEN** 全局阻尼随时间衰减水波能量

#### Scenario: User changes simulation parameters
- **WHEN** 用户调整振幅、波速、阻尼、每帧步数或分辨率
- **THEN** 工具使用新参数重置或更新模拟，使预览保持稳定且不进入无效数值状态

### Requirement: Canvas edges absorb waves instead of reflecting them
系统 SHALL 在模拟画布边缘应用吸收边界。水波接近画布边缘时 MUST 平滑衰减，并且 MUST NOT 从边缘反射回画布内部。

#### Scenario: Wave reaches canvas edge
- **WHEN** 高度扰动传播到画布边缘吸收带
- **THEN** 工具逐步削弱该区域高度值
- **THEN** 波能量在边缘消失而不是反向传播

#### Scenario: User changes edge absorb width
- **WHEN** 用户调整边缘吸收宽度
- **THEN** 工具改变吸收带范围，并保持边缘无反射行为

### Requirement: Preview renders a fixed-size black-and-white height animation
系统 SHALL 在 RightPanel 中使用 PreviewCanvas 渲染固定尺寸黑白高度预览。预览 MUST 显示当前模拟高度场，并 MUST 提供适合检查固定尺寸 raster 输出的共享缩放、适配和平移能力。

#### Scenario: Preview is visible after init map selection
- **WHEN** 用户提供任一有效 init map 来源
- **THEN** 右侧 PreviewCanvas 显示黑白高度动画
- **THEN** 用户可以使用 PreviewCanvas 的 Fit、1:1、缩放和平移能力检查输出

#### Scenario: No init map source is available
- **WHEN** 工具尚无有效 init map 来源
- **THEN** 右侧预览区域显示稳定空态，而不是启动无输入模拟

### Requirement: Tool exports deterministic video frames only through canvas export runtime
系统 SHALL 通过现有 canvas export runtime 注册 `render` 类型 exporter，并只暴露视频导出能力。导出视频时，工具 MUST 根据当前 init map 来源、当前参数和导出 `frameIndex` 确定性渲染帧，而不是依赖当前预览播放进度。

#### Scenario: User exports video
- **WHEN** 用户在 Export Section 中选择 fps 与 duration 并触发视频导出
- **THEN** framework 逐帧调用工具注册的 `renderFrame`
- **THEN** 输出视频中的每一帧都由同一个 init map 来源和固定步进模拟生成

#### Scenario: User requests a static image export
- **WHEN** 用户查看浅水工具的导出能力
- **THEN** 该工具不提供静态图像导出表单
- **THEN** framework 不会对该工具调用图片导出路径