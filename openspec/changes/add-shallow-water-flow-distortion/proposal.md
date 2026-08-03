## Why

当前 `shallow-water-height` 的高度波只能以波源为中心向外传播，不能被持续的水平水流搬运，也无法形成局部转向和涡动。为满足定向流动与扰流视觉效果，需要在现有波动迭代中加入可配置二维速度场和平流。

## What Changes

- 为浅水高度模拟增加二维基础流速 `spd`，使当前高度和上一时刻高度在每次迭代中沿指定方向持续移动。
- 在基础流速上叠加程序化 Distort 速度扰动，形成空间变化并可随模拟步数演化的局部扰流。
- 为基础流速和 Distort 提供英文参数控件，并将参数限制在可稳定采样的范围内。
- 保持现有 Laplacian 波动、阻尼、静止阈值、吸收边界和确定性视频导出行为。
- 不引入新的 npm 依赖，也不升级为完整的守恒型浅水或 Navier–Stokes 求解器。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `shallow-water-height-tool`: 扩展高度传播要求，使波纹在每次模拟迭代中受二维基础流速和程序化 Distort 速度场平流，并保证预览与导出使用同一确定性速度场。

## Impact

- 修改 `src/tools/shallow-water-height/simulation/` 中的参数模型、GPU compute shader、状态步进与纹理采样策略。
- 修改 `src/tools/shallow-water-height/components/ShallowWaterControls.svelte`，增加 Flow 与 Distort 控件。
- 可能补充浅水参数归一化或模拟行为的聚焦验证。
- 不修改共享 shell、file input、PreviewCanvas、canvas export runtime 或工具目录契约。
