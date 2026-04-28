# noise-texture-tool Specification

## Purpose
定义 Noise Texture Creater 工具的噪声族切换、固定方形预览、参数控制与 PNG 导出能力。

## Requirements
### Requirement: 工具提供 Perlin 与 Voronoi 两种可切换噪声族
噪声纹理工具 SHALL 允许用户在 Perlin Noise 与 Voronoi Noise 之间选择且任意时刻仅存在一个活动噪声族。工具 SHALL 在活动噪声族变化时重新生成预览，并且在本次能力范围内 SHALL NOT 暴露第三种噪声族。

#### Scenario: 工具打开时存在受支持的默认噪声族
- **WHEN** 用户打开噪声纹理工具
- **THEN** 工具默认激活一个受支持的噪声族，并显示该噪声族的生成预览

#### Scenario: 用户切换到另一种受支持的噪声族
- **WHEN** 用户选择另一种受支持的噪声族
- **THEN** 工具将该噪声族设为活动状态，并使用该噪声族参数立即重新生成预览

### Requirement: 工具渲染固定 512px 的 1:1 方形预览
噪声纹理工具 SHALL 生成固定 512px x 512px 的输出纹理，并将其渲染到现有 PreviewCanvas 中，而不改变配置的预览内容尺寸。对于所有受支持的噪声族和参数状态，输出 MUST 保持 1:1 方形比例。

#### Scenario: 工具渲染初始预览
- **WHEN** 工具挂载到工作区壳层
- **THEN** 预览内容区域保持 512 像素宽和 512 像素高，并显示方形噪声输出

#### Scenario: 重新生成后预览仍保持方形
- **WHEN** 用户修改任意受支持参数或切换到另一种受支持的噪声族
- **THEN** 重新生成的输出仍然使用 512px x 512px 纹理，并保持 1:1 方形预览

### Requirement: 工具暴露共享参数与噪声族专属参数控制
噪声纹理工具 SHALL 提供一个共享参数组，至少包含 seed、overall scale、horizontal offset、vertical offset、brightness 和 contrast。工具 SHALL 同时提供噪声族专属参数组：Perlin Noise MUST 暴露 octave count、persistence、lacunarity 和 exponent；Voronoi Noise MUST 暴露 cell density、jitter、edge width、edge softness、point radius、point sharpness、fill strength 和 cell variation。

#### Scenario: 用户调整共享参数
- **WHEN** 用户在任一活动噪声族下修改共享参数
- **THEN** 工具使用更新后的共享参数重新生成预览

#### Scenario: 用户选择 Perlin Noise
- **WHEN** 当前活动噪声族为 Perlin Noise
- **THEN** 工具显示 Perlin 专属控制项，并使用这些参数生成预览

#### Scenario: 用户选择 Voronoi Noise
- **WHEN** 当前活动噪声族为 Voronoi Noise
- **THEN** 工具显示 Voronoi 专属控制项，并使用这些参数生成预览

#### Scenario: 用户快速切换 Voronoi 预设
- **WHEN** 当前活动噪声族为 Voronoi Noise 且用户应用一个 Voronoi preset
- **THEN** 工具把 Voronoi 参数组更新为该 preset 值，并立即重新生成预览

### Requirement: 工具仅支持 PNG 图片导出并覆盖 8-bit 与 16-bit
噪声纹理工具 SHALL 仅声明图片导出能力，且在本次能力范围内 MUST NOT 暴露视频导出。工具 SHALL 通过 framework-owned Export Section 导出当前 512px x 512px 输出，并同时支持 8-bit 与 16-bit 两种 PNG 位深选项。

#### Scenario: 工具只暴露图片导出入口
- **WHEN** 用户打开噪声纹理工具的 Export Section
- **THEN** 该分区仅显示图片导出控件，不显示 video tab 或 video 表单

#### Scenario: 用户导出 8-bit PNG
- **WHEN** 用户选择 8-bit PNG 导出并确认
- **THEN** 工具通过 framework 导出流程导出当前方形噪声输出的 PNG 图片

#### Scenario: 用户导出 16-bit PNG
- **WHEN** 用户选择 16-bit PNG 导出并确认
- **THEN** 工具通过 framework 导出流程导出当前方形噪声输出的 16-bit PNG 图片

### Requirement: 工具实现分离噪声族代码并通过共享 Preview 模块输出
噪声纹理工具的实现 SHALL 将 Perlin Noise 与 Voronoi Noise 的生成逻辑保存在独立 TypeScript 模块中。工具 SHALL 通过一个共享的 Pixi-backed preview 组件输出当前选中的噪声族结果，而 master Svelte 入口 SHALL 组合该共享 preview 组件，而不是直接内嵌各噪声族的渲染逻辑。

#### Scenario: 贡献者检查噪声实现结构
- **WHEN** 贡献者检查工具源码目录结构
- **THEN** Perlin 与 Voronoi 生成逻辑位于独立 TypeScript 模块中，而不是合并为单个噪声实现文件

#### Scenario: 主入口组件组织预览输出
- **WHEN** master Svelte 组件渲染该工具
- **THEN** 它把预览渲染委托给一个共享 preview 组件，该组件负责 Pixi-backed 输出路径