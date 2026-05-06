## ADDED Requirements

### Requirement: Tool module is registered as a Three.js image-driven height animation tool
系统 SHALL 新增 `shallow-water-height` 工具模块，工具 SHALL 遵循 `src/tools/<tool-id>/` schema，metadata SHALL 声明图片和视频导出能力，runtime definition SHALL 声明 `techStack: ['three']` 并懒加载 master Svelte 组件。

#### Scenario: Tool appears in workspace catalog
- **WHEN** 工作区发现 `src/tools/shallow-water-height/metadata.json`
- **THEN** 工具目录中出现名为 `Shallow Water Height` 的可用工具
- **THEN** 打开工具时工作区通过共享 tech stack runtime 加载 `three`

### Requirement: Tool accepts a single grayscale image as the init map
系统 SHALL 允许用户通过统一 file input pipeline 导入单张本地图像，并将图像亮度转换为浅水高度场初始状态。导入失败 MUST 保留最近一次成功的 init map。

#### Scenario: User imports a valid image
- **WHEN** 用户选择或拖放一张受支持图像
- **THEN** 工具读取标准化 image input item 的对象 URL 与尺寸
- **THEN** 工具从图像亮度生成初始高度数据，并重置模拟状态

#### Scenario: User imports an invalid file
- **WHEN** 用户提交非图像文件或一次提交多个文件
- **THEN** 工具显示 file input runtime 提供的稳定错误状态
- **THEN** 工具继续保留最近一次成功导入的 init map

### Requirement: Simulation uses damped linear shallow-water height propagation
系统 SHALL 使用线性浅水波/高度场模型推进动画状态。每个模拟步 MUST 根据当前高度、上一帧高度、邻域 Laplacian、波速和阻尼计算下一高度，并 MUST 将数值参数限制在稳定范围内。

#### Scenario: Simulation advances from an init map
- **WHEN** 用户导入 init map 并启动预览
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

#### Scenario: Preview is visible after image import
- **WHEN** 用户导入有效 init map
- **THEN** 右侧 PreviewCanvas 显示黑白高度动画
- **THEN** 用户可以使用 PreviewCanvas 的 Fit、1:1、缩放和平移能力检查输出

#### Scenario: No image has been imported
- **WHEN** 工具尚无有效 init map
- **THEN** 右侧预览区域显示稳定空态，而不是启动无输入模拟

### Requirement: Tool exports deterministic PNG and video frames through canvas export runtime
系统 SHALL 通过现有 canvas export runtime 注册 `render` 类型 exporter。导出 PNG 或视频时，工具 MUST 根据 init map、当前参数和导出 `frameIndex` 确定性渲染帧，而不是依赖当前预览播放进度。

#### Scenario: User exports PNG
- **WHEN** 用户在 Export Section 中触发图片导出
- **THEN** framework 调用工具注册的 `renderFrame({ time: 0, frameIndex: 0 })`
- **THEN** 输出 PNG 包含当前参数下的黑白高度图帧

#### Scenario: User exports video
- **WHEN** 用户在 Export Section 中选择 fps 与 duration 并触发视频导出
- **THEN** framework 逐帧调用工具注册的 `renderFrame`
- **THEN** 输出视频中的每一帧都由同一个 init map 和固定步进模拟生成
