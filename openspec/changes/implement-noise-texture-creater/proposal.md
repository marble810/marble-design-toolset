## Why

当前的 noise-texture-creater 仅处于 PreviewCanvas 脚手架状态，已经声明 Pixi 技术栈，但还没有形成可用的纹理生成能力。现在补全该工具，可以把现有空壳转换为一个符合框架约束的实际生产工具，覆盖程序化噪声贴图生成、参数调节和无缝平铺这类高频需求。

## What Changes

- 将 noise-texture-creater 从占位工具实现为基于 PixiJS 的可交互噪声贴图生成工具。
- 提供 Perlin Noise、Voronoi Noise 与 Alligator Noise 三类噪声模式，并允许在同一工具内切换。
- 保持右侧预览使用既有 512px 画布尺寸，并以 1:1 比例展示最终纹理结果。
- 为每类噪声提供完备的参数调节能力，包括影响图案尺度、分布、混合和边缘过渡的控制项。
- 提供 seamless 边缘模式，使输出纹理可直接用于平铺。
- 按“界面层 - 噪声控制层 - 各噪声实现文件”拆分代码结构，避免将算法、渲染与面板状态耦合在单个 Svelte 组件中。

## Capabilities

### New Capabilities
- `noise-texture-tool`: 提供一个基于 PixiJS 的纹理噪声生成工具，支持多种噪声算法切换、固定尺寸 1:1 预览、完备参数调节以及 seamless 平铺输出。

### Modified Capabilities

无。

## Impact

- 主要影响 src/tools/noise-texture-creater 下的 metadata、主入口组件、私有组件与新增 TypeScript 噪声逻辑模块。
- 复用现有工具壳层、PreviewCanvas 导航能力与共享 Pixi tech stack 加载机制，不引入新的重型运行时依赖。
- 需要新增与该工具行为对应的 OpenSpec capability，以约束噪声类型、预览约束、参数面板与 seamless 行为。