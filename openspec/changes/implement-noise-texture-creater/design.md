## Context

现有的 noise-texture-creater 已经接入工具运行时，并声明了 Pixi tech stack，但主入口组件仍是脚手架占位实现：右侧只有空的 512x512 PreviewCanvas，左侧没有真正的参数面板，现有 VoronoiNoise 组件也只停留在未完成的加载骨架。与此同时，框架已经对工具结构、样式系统和工作区壳层边界给出明确约束：工具必须保留单一 root-level master Svelte 入口、使用框架拥有的 LeftPanel 与 RightPanel、继续依赖共享 PreviewCanvas 导航能力，并通过共享运行时加载 Pixi。

这次变更的核心不是扩展框架，而是在既有工具 contract 内补全一个真正可用的程序化纹理工具。用户要求同时覆盖 Perlin Noise、Voronoi Noise 与 Alligator Noise 三种模式，并明确要求界面层、噪声控制逻辑与各噪声实现文件分离，保持 512px 正方形预览与 1:1 纹理比例，同时支持完整参数调节和 seamless 平铺。

## Goals / Non-Goals

**Goals:**
- 将 noise-texture-creater 实现为可用的 PixiJS 噪声纹理生成工具，而非空壳预览。
- 提供统一的工具状态模型，支持三类噪声切换、共享参数和算法专属参数。
- 保持右侧输出为固定 512x512 的正方形预览，并继续复用 PreviewCanvas 的通用缩放与平移能力。
- 通过独立 TypeScript 模块承载噪声采样与 seamless 逻辑，避免将算法写入 Svelte 组件。
- 使三类噪声都能在参数变更后稳定、即时地重新生成预览结果。

**Non-Goals:**
- 不修改工具运行时、PreviewCanvas 通用导航或工作区壳层的框架级行为。
- 不引入新的重型技术栈或自定义 shader 管线之外的框架依赖管理变更。
- 不在本次变更中加入动画时间轴、批量导出、多尺寸导出或预设库系统。
- 不重命名既有工具 ID，也不处理 noise-texture-creater 之外的工具改造。

## Decisions

### 1. 使用“薄入口组件 + 私有 UI 组件 + TypeScript 噪声模块”分层
根入口 NoiseTextureCreater.svelte 仅负责组织 LeftPanel、RightPanel 和 PreviewCanvas，维护当前选择的噪声类型与参数状态，并把状态分发给私有 UI 组件和预览组件。参数面板与预览宿主组件放在 components/ 下；噪声生成相关逻辑放在工具私有的 TypeScript 模块中，再按噪声类型拆分为独立实现文件。

建议目录形态：
- components/NoiseControls.svelte：渲染共享参数与算法专属参数区
- components/NoisePreview.svelte：挂载 Pixi 应用与预览纹理
- noise/controller.ts：统一参数归一化、触发重新生成、组织输出像素缓冲区
- noise/types/perlin-noise.ts：Perlin 周期噪声采样
- noise/types/voronoi-noise.ts：Voronoi 周期特征点采样
- noise/types/alligator-noise.ts：Alligator 风格纹理采样
- noise/types/shared.ts：共享类型、采样上下文与结果约定

这样可以直接满足“界面 - 噪声逻辑 - 各类噪声 ts 文件分开”的要求。备选方案是把每种噪声做成独立 Svelte 预览组件或把全部逻辑写回单个入口组件，但两者都会让状态、渲染与算法耦合，后续调参和测试成本更高。

### 2. 采用“CPU 采样生成像素缓冲区 + Pixi 负责显示”的渲染路径
噪声采样逻辑在 TypeScript 中直接计算 512x512 像素缓冲区，再把结果上传给 Pixi 纹理并显示到固定尺寸预览区域。Pixi 在这里承担显示与刷新职责，而不是让噪声算法完全依附于 shader。

选择这个方案的原因：
- 固定 512x512 分辨率使 CPU 采样成本可控，足以支撑交互式调参。
- TypeScript 更容易表达三种算法不同的采样逻辑，也更容易实现 deterministic 的 seamless 行为。
- 后续如果需要导出图像或补测试，CPU 侧生成的数据可以直接复用。

备选方案是以自定义 fragment shader 直接在 GPU 上生成纹理。该方案在单一算法上性能更高，但会放大三种噪声模式之间的实现差异，也会让 seamless、参数验证和单元测试更难落地，因此不作为首选。

### 3. 用共享参数 + 算法专属参数的判别联合模型描述工具状态
工具状态分为两层：
- 共享参数：适用于全部噪声类型，如 seed、scale、offset、brightness、contrast、seamless 开关等。
- 算法专属参数：仅对当前选中的噪声模式生效，例如 Perlin 的 octave/persistence/lacunarity，Voronoi 的 cell density/jitter/edge softness，Alligator 的 ridge、warp 与 crack shaping。

状态模型使用以 noise type 为判别字段的联合类型，避免把所有参数塞入一个松散对象。参数面板只渲染当前模式所需的字段；控制器则先读取共享参数，再把当前模式参数分发给对应采样器。备选方案是单一大对象配合可选字段，但那会削弱默认值管理、UI 分组与类型安全。

### 4. seamless 通过周期采样实现，而不是后期边缘混合
三类噪声都需要直接生成可平铺结果，因此 seamless 不能靠最终图像边缘做线性混合补丁，而要在采样阶段保证左右、上下边界天然对齐。

实现策略：
- Perlin Noise 使用可重复的梯度格点与周期性插值，保证一个重复周期内首尾相接。
- Voronoi Noise 使用包裹坐标系下的特征点集合，并以最短 wrapped distance 计算最近邻与边缘距离。
- Alligator Noise 在包裹坐标系上基于周期 cellular/ridge 组合构造，保证鳞片与裂纹在边界处延续。

后处理边缘混合虽然实现简单，但会在高对比或高频参数下留下可见缝合痕迹，也会破坏参数语义，因此不采用。

### 5. 保持 512x512 正方形输出，继续把导航能力留给 PreviewCanvas
工具继续使用 PreviewCanvas，并固定 contentWidth=512、contentHeight=512。Pixi 预览宿主的实际纹理尺寸与输出尺寸一致，确保纹理逻辑本身始终是 1:1 的正方形内容；缩放、Fit 和 1:1 交互仍由共享 PreviewCanvas 处理，而不是由工具自己再实现一层画布导航。

备选方案是让工具自建自适应画布或允许用户调整输出分辨率，但这会偏离用户提出的“保持 512px 预览不变”要求，也会扩大本次设计与测试范围。

## Risks / Trade-offs

- [CPU 采样在频繁拖动参数时可能出现抖动或卡顿] → 通过固定 512x512 输出、仅在参数变化后触发单次重算，并优先使用轻量循环与复用缓冲区降低开销。
- [Alligator Noise 的视觉定义天然比 Perlin/Voronoi 更主观] → 在 design 和 specs 中把它界定为“具有鳞片/裂纹感的周期 cellular-ridge 纹理”，并要求提供专属参数而不是追求唯一数学标准。
- [参数数量较多会让左侧面板复杂] → 通过共享参数区、模式切换区和算法专属折叠区控制信息密度，只展示当前模式相关参数。
- [Pixi 预览生命周期处理不当会导致重复挂载或资源泄露] → 由单独的预览组件统一创建、更新和销毁 Pixi 应用及纹理资源，避免在根组件中直接操作 document.body。

## Migration Plan

该变更只涉及单个工具模块与其 OpenSpec artifact，不涉及数据迁移或已有用户内容迁移。实施时可以直接在现有 noise-texture-creater 目录内替换脚手架实现；若需要回滚，只需回退该工具目录与对应 change 文件。

## Open Questions

- 无阻塞当前提案的问题。若实现阶段发现 Alligator Noise 需要更明确的视觉基准，可在 apply 阶段通过示例图或预设参数补充验证标准。