## MODIFIED Requirements

### Requirement: Simulation uses damped linear shallow-water height propagation
系统 SHALL 使用带二维速度场平流的线性浅水波/高度场模型推进动画状态。每个模拟步 MUST 根据基础流速与程序化 Distort 计算当前位置的回溯采样点，MUST 从该采样点读取当前高度、上一时刻高度及邻域高度，再根据邻域 Laplacian、波速和阻尼计算下一高度。系统 MUST 对连续回溯位置进行平滑采样，并 MUST 将波动与速度参数限制在稳定范围内。

#### Scenario: Simulation advances from the selected init map source
- **WHEN** 用户提供任一有效 init map 来源并启动预览
- **THEN** 初始亮度分布作为高度扰动向周围传播
- **THEN** 全局阻尼随时间衰减水波能量

#### Scenario: User changes simulation parameters
- **WHEN** 用户调整振幅、波速、阻尼、每帧步数、分辨率或速度场参数
- **THEN** 工具使用归一化后的新参数重置或更新模拟
- **THEN** 预览保持有限数值且不进入无效采样状态

#### Scenario: Base flow advects the wave
- **WHEN** 用户把二维基础流速设置为非零向量
- **THEN** 工具在每次模拟迭代中沿该向量方向搬运当前高度和上一时刻高度
- **THEN** 波纹在继续传播和衰减的同时持续沿基础流向移动

#### Scenario: Distort perturbs the flow field
- **WHEN** 用户把 Distort Strength 设置为非零值
- **THEN** 工具在基础流速上叠加确定性的局部旋转扰动
- **THEN** 波纹出现局部转向、拉伸和涡动，而不是只做统一方向平移

### Requirement: Tool exports deterministic PNG and video frames through canvas export runtime
系统 SHALL 通过现有 canvas export runtime 注册 `render` 类型 exporter。导出 PNG 或视频时，工具 MUST 根据当前 init map 来源、当前参数、整数模拟步数和导出 `frameIndex` 确定性渲染帧，而不是依赖当前预览播放进度或墙上时钟。基础流速与 Distort 速度场 MUST 在预览和导出中使用同一计算规则。

#### Scenario: User exports PNG
- **WHEN** 用户在 Export Section 中触发图片导出
- **THEN** framework 调用工具注册的 `renderFrame({ time: 0, frameIndex: 0 })`
- **THEN** 输出 PNG 包含当前参数下的黑白高度图帧

#### Scenario: User exports video
- **WHEN** 用户在 Export Section 中选择 fps 与 duration 并触发视频导出
- **THEN** framework 逐帧调用工具注册的 `renderFrame`
- **THEN** 输出视频中的每一帧都由同一个 init map 来源、固定步进模拟和确定性速度场生成

## ADDED Requirements

### Requirement: Tool exposes two-dimensional flow and Distort controls
系统 SHALL 在 `shallow-water-height` 的 Simulation 控制区提供英文的二维基础流速与 Distort 参数控件。控制面 MUST 至少包含 `Flow X`、`Flow Y`、`Distort Strength`、`Distort Scale` 和 `Distort Speed`；默认值 MUST 保留当前无平流行为，重置参数 MUST 同时恢复这些默认值。

#### Scenario: User configures the base flow
- **WHEN** 用户调整 `Flow X` 或 `Flow Y`
- **THEN** 工具更新二维基础流速
- **THEN** 正负值分别产生对应轴向的相反流动方向

#### Scenario: User configures flow distortion
- **WHEN** 用户调整 Distort Strength、Distort Scale 或 Distort Speed
- **THEN** 工具分别更新扰动幅度、空间尺度和随模拟步数演化的速率
- **THEN** 参数变化不要求新的文件输入或外部速度贴图

#### Scenario: User resets parameters
- **WHEN** 用户触发 `Reset Parameters`
- **THEN** Flow X、Flow Y 和 Distort Strength 恢复为零
- **THEN** 模拟恢复为不带平流的现有波动行为
