## Why

当前 change 中关于 noise-texture-creater 的范围已经与最新需求不一致：artifact 仍然围绕第三种噪声族、视频导出和更宽的输出能力展开，而最新目标已经收窄为一个固定 512x512 的 Pixi 噪声贴图工具，只覆盖 Perlin Noise 与 Voronoi Noise，并且只提供 PNG 8-bit / 16-bit 图片导出。现在需要先把 OpenSpec 约束改准，再进入实现。

## What Changes

- 将 noise-texture-creater 定义为一个基于 PixiJS 的新工具，右侧预览固定为 512x512 的 1:1 方形输出。
- 将可切换噪声族收窄为两种：Perlin Noise 与 Voronoi Noise。
- 为两种噪声保留详细可调参数，并继续提供共享参数组。
- 将导出范围限定为 PNG 图片导出，且仅支持 8-bit 与 16-bit，两者都不扩展到视频导出。
- 将实现结构明确为“总入口 Svelte + 共享 Preview 模块 + 分离的 Perlin / Voronoi TypeScript 模块”。

## Capabilities

### New Capabilities
- `noise-texture-tool`: 提供一个基于 PixiJS 的噪声纹理生成工具，支持 Perlin 与 Voronoi 两种噪声切换、固定 512x512 方形预览、详细参数控制，以及 PNG 8-bit / 16-bit 图片导出。

### Modified Capabilities

无。

## Impact

- 主要影响 src/tools/noise-texture-creater 下的 metadata、主入口组件、私有组件与新增 TypeScript 噪声逻辑模块。
- 复用现有工具壳层、PreviewCanvas 导航能力、共享 Pixi tech stack 加载机制与 canvas export runtime，不引入新的重型运行时依赖。
- 需要同步更新 proposal、design、tasks 与 spec，去掉 Alligator Noise、视频导出与超出本次范围的能力描述。