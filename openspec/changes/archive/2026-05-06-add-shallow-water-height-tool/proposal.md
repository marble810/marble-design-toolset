## Why

当前工具集缺少一个从黑白 init map 直接生成程序化高度动画的工具。新增浅水高度动画工具可以把静态灰度图转化为可预览、可导出的黑白水波高度 MP4，补足图像输入到动态纹理输出的创作流程。

## What Changes

- 新增一个 `three` 驱动的浅水高度动画工具，读取本地黑白图像作为初始高度图。
- 工具使用线性浅水波/高度场模型、全局阻尼和吸收边界，让水波抵达画布边缘后衰减销毁而不反射。
- 工具提供固定分辨率模拟、波速、阻尼、初始振幅、边缘吸收宽度、每帧步数、显示对比度、反相等控制。
- 工具在右侧工作区提供黑白高度动画预览，并通过现有 canvas export runtime 支持 PNG 与视频导出。
- 工具复用现有 file input pipeline、tool runtime、右侧预览与导出能力，不修改共享框架契约。

## Capabilities

### New Capabilities
- `shallow-water-height-tool`: 定义从黑白 init map 生成浅水高度动画的工具级行为、控制参数、边界行为、预览和导出要求。

### Modified Capabilities

无。

## Impact

- 新增 `src/tools/shallow-water-height/` 工具目录及其静态 metadata、runtime definition 和 Svelte 组件。
- 使用现有 `three` 依赖，并在工具 `index.ts` 中声明 `techStack: ['three']`。
- 使用现有 `src/lib/runtime/file-input/` 接收本地图像。
- 使用现有 canvas export runtime 注册 `render` 类型导出源，支持静帧和视频导出。
- 不引入新的 npm 依赖，不改变共享 shell、导出框架或 file input 框架行为。