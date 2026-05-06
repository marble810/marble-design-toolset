# preset-init-map-source Specification

## Purpose
定义共享 preset init map source 运行时，使工具可以复用确定性的灰度初始图生成能力，而不依赖其他工具的私有实现。

## Requirements

### Requirement: Tools can consume a shared preset init map source runtime
系统 SHALL 提供一个共享的 preset init map source 运行时模块，使任意 tool 无需依赖其他 tool 私有代码即可导入它并请求灰度 init map 栅格输出。该模块 MUST 暴露稳定的参数类型与按目标尺寸生成栅格数据的入口。

#### Scenario: A tool imports the shared preset source runtime
- **WHEN** 某个 tool 需要一个程序化灰度 init map 作为输入源
- **THEN** 该 tool 可以直接导入共享 preset init map source 模块
- **THEN** 该模块返回可供该 tool 继续消费的栅格数据，而不是要求该 tool 依赖另一个 tool 的内部组件

### Requirement: Preset source supports circle and square shapes with fill or outline modes
共享 preset init map source SHALL 支持 `circle` 与 `square` 两种基础 shape。每种 shape MUST 提供归一化的位置、尺寸和 feather 参数，并 MUST 支持 `fill` 与 `outline` 两种模式。当 mode 为 `outline` 时，系统 MUST 额外支持可调的归一化 outline width，并 SHALL 产出边框厚度与边缘软化都可控的灰度分布。

#### Scenario: Tool requests a filled circle preset
- **WHEN** tool 以 `circle` preset、`fill` mode 和一组位置、尺寸、feather 参数请求 init map
- **THEN** 返回的灰度栅格在指定位置形成圆形核心区域
- **THEN** 圆形边界按照 feather 参数平滑衰减，而不是硬边截断

#### Scenario: Tool requests an outlined circle preset
- **WHEN** tool 以 `circle` preset、`outline` mode 以及位置、尺寸、outline width、feather 参数请求 init map
- **THEN** 返回的灰度栅格形成一个圆环形区域，而不是实心圆
- **THEN** 圆环厚度由 outline width 控制，边缘软化由 feather 控制

#### Scenario: Tool requests a filled square preset
- **WHEN** tool 以 `square` preset、`fill` mode 和一组位置、尺寸、feather 参数请求 init map
- **THEN** 返回的灰度栅格在指定位置形成方形核心区域
- **THEN** 方形边界按照 feather 参数平滑衰减，而不是硬边截断

#### Scenario: Tool requests an outlined square preset
- **WHEN** tool 以 `square` preset、`outline` mode 以及位置、尺寸、outline width、feather 参数请求 init map
- **THEN** 返回的灰度栅格形成一个方框区域，而不是实心方形
- **THEN** 方框厚度由 outline width 控制，边缘软化由 feather 控制

### Requirement: Preset source supports full-span horizontal and vertical bars
共享 preset init map source SHALL 支持 `horizontal-bar` 与 `vertical-bar` 两种全幅条带 shape。`horizontal-bar` MUST 铺满整个 width，仅允许调节其纵向位置、厚度与 feather；`vertical-bar` MUST 铺满整个 height，仅允许调节其横向位置、厚度与 feather。

#### Scenario: Tool requests a horizontal bar preset
- **WHEN** tool 选择 `horizontal-bar` preset 并设置位置、厚度与 feather
- **THEN** 返回的灰度栅格形成一条横向铺满整个输出宽度的条带
- **THEN** 条带边缘按照 feather 参数平滑衰减

#### Scenario: Tool requests a vertical bar preset
- **WHEN** tool 选择 `vertical-bar` preset 并设置位置、厚度与 feather
- **THEN** 返回的灰度栅格形成一条纵向铺满整个输出高度的条带
- **THEN** 条带边缘按照 feather 参数平滑衰减

### Requirement: Preset rasterization is deterministic and resolution-independent
共享 preset init map source SHALL 以确定性方式生成 `0..1` 灰度栅格。相同的 preset descriptor 在相同目标尺寸下 MUST 生成相同结果；其位置、尺寸、outline width 与 feather 的参数语义 MUST 与具体输出分辨率解耦，从而在不同尺寸下保持一致的形状含义。

#### Scenario: Same preset is sampled twice at the same size
- **WHEN** tool 以同一组 preset 参数两次请求同一目标尺寸的 init map
- **THEN** 两次得到的灰度栅格内容完全一致

#### Scenario: Same preset is sampled at different sizes
- **WHEN** tool 以同一组归一化 preset 参数分别请求 128x128 和 512x512 的 init map
- **THEN** 两个输出在各自尺寸下保持一致的相对位置、尺寸和 feather 语义
