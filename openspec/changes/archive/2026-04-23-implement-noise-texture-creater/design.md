## Context

当前 active change 已经存在，但 artifact 仍描述一个比最新需求更宽的噪声工具版本：包含第三种噪声族、额外导出方向和超出本次范围的行为。而最新要求已经明确收窄为一个新的 PixiJS 纹理工具，只需要固定 512x512 的 1:1 方形输出、Perlin Noise 与 Voronoi Noise 两种噪声、详细参数面板，以及 PNG 8-bit / 16-bit 图片导出。

这次变更的核心不是扩展框架，而是先把工具级方案收敛到最新需求，再据此实现。工具仍需遵守既有框架边界：保留单一 root-level master Svelte 入口、使用框架拥有的 LeftPanel 与 RightPanel、继续依赖 PreviewCanvas 的共享导航能力，并通过共享 runtime 加载 Pixi。

## Goals / Non-Goals

**Goals:**
- 将 noise-texture-creater 定义为一个基于 PixiJS 的可用噪声纹理工具。
- 只支持 Perlin Noise 与 Voronoi Noise 两种可切换噪声族。
- 保持右侧输出为固定 512x512 的 1:1 正方形预览。
- 提供共享参数和噪声族专属参数，形成详细可调的左侧面板。
- 只支持 PNG 图片导出，并明确覆盖 8-bit 与 16-bit 两种位深。
- 通过独立 TypeScript 模块拆分 Perlin / Voronoi 实现，并由一个总括性的 Preview 模块统一输出到主 Svelte。

**Non-Goals:**
- 不引入 Alligator Noise 或其他第三种噪声族。
- 不在本次变更中加入视频导出、动画时间轴、多尺寸输出或预设库系统。
- 不修改工具运行时、PreviewCanvas 通用导航或工作区壳层的框架级行为。
- 不引入 Pixi 之外的新重型技术栈。

## Decisions

### 1. 使用“总入口组件 + 参数组件 + 共享 Preview 组件 + 分离噪声模块”的分层结构
根入口 NoiseTextureCreater.svelte 只负责组织 LeftPanel、RightPanel 和 PreviewCanvas，维护当前噪声族与参数状态，并把状态分发给私有 UI 组件和共享预览组件。具体建议目录形态：

- components/NoiseControls.svelte：渲染共享参数区与噪声族专属参数区
- components/NoisePreview.svelte：统一持有 Pixi 生命周期、纹理上传与导出注册
- noise/controller.ts：统一参数归一化、输出缓冲区生成与预览侧数据桥接
- noise/generators/perlin-noise.ts：Perlin 噪声生成逻辑
- noise/generators/voronoi-noise.ts：Voronoi 噪声生成逻辑
- noise/shared.ts：共享类型、默认值与像素缓冲区约定

这样可以直接满足“两个噪声实现文件分离，再通过一个总括性的 Preview 模块输出到总 Svelte”的要求，并避免把算法、渲染和面板状态耦合在单个组件里。

### 2. 采用“CPU 生成像素缓冲区 + Pixi 负责显示”的渲染路径
噪声采样逻辑在 TypeScript 中直接生成 512x512 像素缓冲区，再把结果上传给 Pixi 纹理并显示到固定尺寸预览区域。Pixi 负责显示、刷新和画布导出桥接，而不是承担噪声算法本身。

选择这个方案的原因：
- 固定 512x512 分辨率让 CPU 采样成本保持可控。
- Perlin 与 Voronoi 的生成逻辑可以清晰地放在两个独立 TS 文件中。
- 后续 8-bit 与 16-bit PNG 导出都可以直接复用同一套像素数据来源。

### 3. 用共享参数 + 噪声族专属参数的判别联合模型描述状态
工具状态分为两层：
- 共享参数：seed、overall scale、horizontal offset、vertical offset、brightness、contrast
- 噪声族专属参数：Perlin 使用 octave count、persistence、lacunarity、exponent；Voronoi 使用 cell density、jitter、edge width、edge softness，以及用于控制形态空间的 point radius、point sharpness、fill strength、cell variation

同时在 Voronoi 区增加一组 quick presets，作为常见风格的起点。preset 只覆盖 Voronoi 专属参数，不改 shared 参数，这样用户可以先选风格，再继续围绕 seed、scale、brightness 和 contrast 微调。

状态模型使用以 noise family 为判别字段的联合类型，避免把所有参数塞进一个松散对象。参数面板只渲染当前噪声族需要的字段；控制器先读取共享参数，再把当前族的参数分发给对应生成器。

### 4. 导出能力限定为 framework-owned 的 PNG 图片导出
metadata 只声明图片导出能力，不声明视频导出。共享 Preview 组件在初始化后向 canvas export runtime 注册 exporter，并提供：

- 8-bit PNG 所需的 canvas 抓取路径
- 16-bit PNG 所需的高位深像素缓冲区访问路径

这样既符合“只需支持 png 8bit or 16bit 输出”的范围，也与现有 framework-owned Export Section 契约一致。

### 5. 保持 512x512 方形输出，不扩展到其他比例
工具继续使用 PreviewCanvas，并固定 contentWidth=512、contentHeight=512。工具本身只生成 1:1 的方形纹理，不引入额外比例切换。PreviewCanvas 仍可复用 framework 已提供的共享导航行为，但工具自身的输出 contract 始终是单一的方形尺寸。

## Risks / Trade-offs

- [CPU 采样在频繁拖动参数时可能出现卡顿] → 通过固定 512x512 输出、复用缓冲区和尽量轻量的参数更新策略控制开销。
- [16-bit PNG 需要额外维护一条高位深像素路径] → 在共享 Preview 组件内统一导出桥接，避免把位深逻辑散落到 UI 组件。
- [参数较多会增加左侧面板复杂度] → 通过共享参数区、噪声族切换区和专属参数分组保持信息层次清晰。
- [Pixi 生命周期处理不当会导致重复挂载或资源泄露] → 由单独的 Preview 组件统一创建、更新和销毁 Pixi 应用及纹理资源。

## Migration Plan

该变更只涉及单个工具模块与其 OpenSpec artifact，不涉及数据迁移。实施时按当前 change artifact 创建并实现 noise-texture-creater 目录；若需要回滚，只需回退该工具目录与对应 change 文件。

## Open Questions

- 当前无阻塞问题。若实现阶段发现 Perlin 或 Voronoi 的默认参数需要更明确的视觉基准，可在 apply 阶段通过默认值和示例参数进一步收敛。