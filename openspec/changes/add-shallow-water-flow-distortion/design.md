## Context

当前 `shallow-water-height` 用半浮点 ping-pong render target 保存 `R = 当前高度`、`G = 上一时刻高度`，compute shader 从四邻域 Laplacian 推进阻尼线性波。采样位置固定在当前 texel，因此波只会围绕初始扰动传播，不会被水平水流持续搬运。

本次所称 speed map 是 compute shader 内每步计算的二维速度场，不新增第二套文件输入：基础 `spd` 提供统一流向，Distort 在其上叠加程序化局部扰动。实现仍需保持固定步进导出的确定性、吸收边界和现有工具目录边界。

## Goals / Non-Goals

**Goals:**

- 让波纹在每次 GPU 模拟迭代中沿可配置 `float2`/`vec2` 基础速度持续移动。
- 通过程序化 Distort 速度场产生局部转向和涡动。
- 为非整数速度提供连续采样，避免按像素跳格。
- 让预览与按 `frameIndex` 重放的导出得到同一结果。
- 默认关闭流动和扰动，保留现有项目与参数重置语义。

**Non-Goals:**

- 不导入外部 speed map，也不增加第二个 file input pipeline。
- 不求解速度场反馈、压力、质量守恒、黏性或完整 Navier–Stokes / Saint-Venant 方程。
- 不让水波反向改变速度场。
- 不新增噪声库、GPU computation framework 或共享 runtime 抽象。

## Decisions

### 1. 使用半拉格朗日回溯平流现有高度状态

compute shader 把当前 `vUv` 视为目标位置，根据本步速度从上游位置读取状态：

```text
flow = baseFlow + distortFlow
sourceUv = vUv - flow * texelSize
```

当前高度、上一时刻高度以及 Laplacian 四邻域都围绕 `sourceUv` 采样，随后继续执行现有波动、阻尼、边缘吸收、钳制与 Rest Threshold。输出的历史通道写入已平流的当前高度，因此两个时间层会一起沿速度场移动。

选择回溯而不是把 `spd` 加到高度值，是因为速度改变位置而不是振幅。选择半拉格朗日采样而不是前向散射，是因为 fragment shader 天然按目标像素写入，回溯不会产生空洞或多个像素争写。

### 2. 速度单位采用“每个 compute step 的网格单元”

`Flow X`、`Flow Y` 与 Distort Strength 都转换为每次模拟迭代移动的网格单元，再乘 `texelSize` 得到纹理坐标偏移。现有 renderer 会随分辨率增加每个逻辑帧的 compute step 数，因此该单位在不同分辨率下可近似保持相同的归一化画面速度。

总速度应在参数归一化或 shader 中设置保守上限。半拉格朗日方法即使跨越多个网格仍可运行，但过大位移会跳过细节，因此控制范围以视觉质量为先。

备选方案：把速度定义为 UV/帧。放弃原因是每步还要知道当前逻辑帧内的实际子步数，增加 renderer 与 shader 的耦合。

### 3. Distort 使用确定性的无散度倾向旋转场

Distort 在 shader 内由位置、尺度和模拟步数生成标量程序噪声，再通过二维 curl/旋转梯度构造局部速度偏转。相比把两个互不相关的噪声值直接作为 X/Y 速度，curl 场更少制造明显的凭空聚集和抽空，更适合作为水流视觉扰动。

参数模型增加：

- `flowX`、`flowY`：基础流速。
- `distortStrength`：扰动速度幅度；零值完全绕过扰动。
- `distortScale`：空间频率。
- `distortSpeed`：噪声相位随模拟步数变化的速率；零值产生静态涡流。

本次直接把最小噪声/curl 函数放在工具私有 shader 中，不抽取共享 noise runtime，因为当前没有第二个 GPU 消费者。

备选方案：扭曲 speed map 的采样坐标。放弃原因是当基础 speed map 为常量时，扭曲采样坐标仍会得到同一个速度，无法产生扰流。

### 4. Distort 时间只来自整数模拟步数

renderer 维护从零开始的 compute step 计数；设置初始高度时重置，执行每个 `step()` 后递增。shader 的 Distort 相位从该计数和分辨率缩放计算，不读取 `performance.now()` 或 RAF 时间。

这样预览重置和导出重放都从同一相位开始，导出到任意 `frameIndex` 时只需沿用现有固定步进逻辑。

备选方案：使用墙上时钟驱动。放弃原因是预览帧率变化和离屏导出会产生不同速度场，破坏确定性。

### 5. 计算纹理使用连续采样

当前 render target 使用 `NearestFilter`，非整数回溯位移会表现为跳格。计算目标纹理改为线性过滤，使 `texture2D` 在回溯位置插值；初始编码纹理仍可保持最近邻读取。回溯坐标钳制在有效 texel 中心范围，外围 guard band 和现有 edge absorb 继续负责消散流出波纹。

线性平流会产生一定数值扩散，这是艺术工具中连续运动换取的可接受代价。若后续确认扩散不可接受，再单独评估更高阶平流；本次不提前实现。

## Risks / Trade-offs

- [线性回溯采样会让高频波纹更快变软] → 保持每步速度上限，并继续允许用户通过 Damping、Steps / Frame 和 Contrast 调节结果。
- [Distort 过强时可能拉伸或折叠局部波形] → 对参数和合成后的速度设置保守范围，避免一次跨越过多网格。
- [动态 curl 噪声增加每像素每步的 shader 成本] → 使用工具私有的最小程序噪声，Distort Strength 为零时跳过额外计算，不增加新纹理 pass。
- [不同设备的半浮点线性过滤能力存在差异] → 依赖 Three.js/WebGL 的目标纹理能力；若初始化或采样不可用，沿用现有预览错误处理，不静默输出损坏结果。
- [该效果看起来像流体但不满足质量守恒] → UI 和规格将其定义为 Flow/Distort 视觉平流，不宣称为完整流体速度求解。

## Migration Plan

1. 扩展浅水参数类型、默认值与归一化范围，默认 Flow 和 Distort 为零。
2. 增加英文 Flow/Distort 控件。
3. 在 compute shader 中加入确定性速度场、回溯采样与连续过滤，并让 renderer 管理模拟步计数。
4. 验证预览、重置和离屏导出都从相同初始状态与 Distort 相位推进。
5. 运行聚焦测试与 `npm run build`。

回滚时删除新增参数与 shader 平流路径，并把计算纹理恢复为最近邻过滤；现有 init map、波动与导出契约无需迁移。

## Open Questions

当前无阻塞问题。外部 speed map 输入、速度场可视化和更高阶平流留给后续独立变更。
