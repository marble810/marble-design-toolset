# Tool 开发指南

> 适用版本：当前仓库（基于 Pixel Tool Framework）

## 开始之前

这份指南告诉你如何在当前 Pixel Tool Framework 中从零创建一个 tool，让它自动出现在 workspace 的 Open Tool 列表里，并与现有的 shell、路由和 tech stack 加载机制无缝衔接。

读完后你应该能：

- 建立正确的目录结构
- 写出满足运行时合约的 `metadata.json` 和 `index.ts`
- 把自己的 UI 挂进 `LeftPanel` 和 `PreviewCanvas`
- 在需要时声明 Three.js、Pixi.js 或 GSAP 并安全使用
- 明确知道哪些事情不能做

相关参考文件：

| 文件 | 内容 |
| --- | --- |
| `src/lib/types/tool.ts` | `ToolDefinition`、`ToolMetadata` 等核心类型 |
| `src/lib/runtime/tool-registry.ts` | catalog 发现与 definition 懒加载逻辑 |
| `src/lib/runtime/tech-stack.ts` | heavy tech stack 加载器与缓存 |
| `src/routes/+page.svelte` | 顶层 tool 装载流程 |
| `src/lib/components/shell/index.ts` | shell 组件统一导出 |
| `src/tools/hello-world/` | 最简 tool 示例 |
| `src/tools/aspect-ratio/` | 参数型 tool 示例 |
| `src/tools/three-cube/` | heavy tech stack 示例 |

## 推荐方式：先用脚手架

当前仓库已经提供项目内脚手架命令：

```bash
bun run create:tool
```

该命令会交互式收集三类核心信息：

- `tool name`
- `starter type`：`preview` 或 `stage`
- `tech stacks`：`three`、`pixi`、`gsap` 的逗号分隔选择

脚手架会自动完成这些事情：

- 把输入名称规范化为 `tool-id`、显示名和 PascalCase master 组件名
- 生成 `metadata.json`、`index.ts`、唯一的 root-level master `.svelte`
- 在 `components/` 下生成一个 starter 对应的私有子组件
- 默认写入 `enabled: true`
- 只在 `index.ts` 中写入 `techStack`，不会污染 `metadata.json`

默认 metadata 如下：

- `desc`: `<Starter> starter scaffold for the <Tool Name> tool.`
- `tag`: `['starter', '<starter-type>']`
- `version`: `1.0.0`

如果你需要完全手写或审查脚手架输出，继续阅读下面的手工目录与 contract 说明。

## 快速上手

如果你想手工创建或审查脚手架生成结果，这是最小可运行示例的完整形态。后面的章节会逐一解释每个决策背后的原因。

目录结构：

```text
src/tools/frame-label/
├── metadata.json
├── index.ts
├── FrameLabel.svelte
└── components/
```

`metadata.json`：

```json
{
  "name": "Frame Label",
  "desc": "Add a short label to a fixed-size preview frame.",
  "tag": ["example", "starter", "preview"],
  "version": "1.0.0",
  "enabled": true
}
```

`index.ts`：

```ts
import metadata from './metadata.json';
import type { ToolDefinition } from '$lib/types/tool';

const definition = {
  metadata,
  loadComponent: () => import('./FrameLabel.svelte')
} satisfies ToolDefinition;

export default definition;
```

`FrameLabel.svelte`：

```svelte
<script lang="ts">
  import { LeftPanel, PreviewCanvas, RightPanel, Section } from '$lib/components/shell/index.js';

  let label = $state('Sample Label');
  let accent = $state('#9580ff');
</script>

<LeftPanel>
  <Section title="Content">
    <label class="frame-label__field">
      <span class="frame-label__caption">Label</span>
      <input class="pixel-input" bind:value={label} maxlength="24" placeholder="Enter a label" />
    </label>
  </Section>

  <Section title="Style" collapsible>
    <label class="frame-label__field">
      <span class="frame-label__caption">Accent Color</span>
      <input class="pixel-input" bind:value={accent} placeholder="#9580ff" />
    </label>
  </Section>
</LeftPanel>

<RightPanel>
  <PreviewCanvas contentWidth={640} contentHeight={360} label="Frame Label Preview">
    <div class="frame-label__preview" style={`--frame-label-accent:${accent};`}>
      <div class="frame-label__badge">Preview</div>
      <h2 class="frame-label__title">{label || 'Sample Label'}</h2>
    </div>
  </PreviewCanvas>
</RightPanel>

<style>
  .frame-label__field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .frame-label__caption {
    color: var(--color-fg-secondary);
    font-size: var(--font-size-1);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .frame-label__preview {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    width: 100%;
    height: 100%;
    padding: 32px;
    border: 2px solid var(--frame-label-accent);
    background: #16202f;
  }

  .frame-label__badge {
    display: inline-flex;
    align-self: flex-start;
    align-items: center;
    height: 22px;
    padding: 0 var(--space-2);
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(9, 13, 22, 0.78);
    color: var(--color-fg-secondary);
    font-size: var(--font-size-1);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .frame-label__title {
    margin: var(--space-4) 0 0;
    font-size: 36px;
    line-height: 1;
  }
</style>
```

完成后执行 `npm run build`。如果构建通过，这个 tool 就已经自动出现在 catalog 里了，不需要手动注册任何东西。

## 框架职责边界

在写第一行代码前，有一件事值得先明确：framework 和 tool 各自负责什么。

Framework 负责：

- workspace 顶层壳层，包括 header、tabs、settings、dialogs
- tool catalog 发现与 hash 路由
- `ToolShell` 的创建和挂载
- `MainInfo` 的渲染
- 提供可选的右侧容器组件（`PreviewCanvas` 用于 2D 预览，`FullStage` 用于全出血场景）
- heavy tech stack 的预加载
- 视口宽度小于 720px 时的阻断屏幕

Tool 只负责两件事：

- 左侧参数和信息内容
- 右侧内容（自由选择使用 PreviewCanvas、FullStage 或自定义内容填充 RightPanel）

这个边界不是建议，而是框架能正常工作的前提。tool 如果重写 shell 层、重新造一套 workspace 结构，得到的不是扩展，而是破坏。

## 目录 Schema

每个 tool 必须遵循以下结构：

```text
src/tools/<tool-id>/
├── metadata.json
├── index.ts
├── <ToolName>.svelte
└── components/
    ├── PrivatePanel.svelte
    └── ...
```

命名规则：

- `tool-id` 使用 kebab-case，例如 `aspect-ratio`、`three-cube`
- master 组件文件名使用对应 PascalCase，例如 `AspectRatio.svelte`、`ThreeCube.svelte`
- 工具根目录只允许一个 root-level `.svelte`
- 其余私有 `.svelte` 一律放进 `components/`

为什么根目录只能有一个 `.svelte`？因为 `index.ts` 的 `loadComponent` 入口必须指向那个唯一的 master 文件。如果根目录里放多个 `.svelte`，code review 时就需要猜哪个是主入口，子组件和入口组件的边界也会消失。

## 每个文件的职责

### `metadata.json`

`metadata.json` 只放无需加载 tool 运行时代码即可判定的静态元数据。runtime 会用它生成 catalog、展示 `MainInfo` 的标题和描述，并决定工具是否进入可用工具集合。

支持字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `name` | `string` | tool 的英文显示名，直接面向用户 |
| `desc` | `string` | 一句英文描述这个 tool 做什么 |
| `tag` | `string[]` | 英文小写短词数组 |
| `version` | `string` | 建议使用 semver，例如 `1.0.0` |
| `enabled` | `boolean` | 可选硬开关。省略时默认按 `true` 处理；设为 `false` 时，该工具不会出现在工具架中，也不会被 hash 或本地恢复重新激活 |

不应该出现在这里的内容：`techStack`、`loadComponent`、组件路径、默认状态、任何 runtime 逻辑。

错误示例：

```json
{
  "name": "My Tool",
  "desc": "Does something.",
  "tag": ["example"],
  "version": "1.0.0",
  "techStack": ["three"],
  "loadComponent": "./MyTool.svelte"
}
```

### `index.ts`

`index.ts` 是 tool 的 runtime definition 文件。它告诉 framework 这个 tool 如何加载、需要什么 tech stack、有哪些菜单项。

最小模板：

```ts
import metadata from './metadata.json';
import type { ToolDefinition } from '$lib/types/tool';

const definition = {
  metadata,
  loadComponent: () => import('./FrameLabel.svelte')
} satisfies ToolDefinition;

export default definition;
```

必须遵守的规则：

- 必须使用 `satisfies ToolDefinition`
- `loadComponent` 必须是懒加载函数，不要在顶部直接 import master `.svelte`
- 如果 tool 任意位置会使用 `three`、`pixi` 或 `gsap`，必须在这里声明 `techStack`
- 文件末尾必须 `export default definition`

### root-level master `.svelte`

这是 tool 的 UI 入口，也是唯一被 `index.ts` 直接引用的组件。它负责：

- 组织 `LeftPanel` 和 `RightPanel` 的内容
- 管理当前 tool 的局部状态
- 组合私有子组件

它不应该包含 workspace shell 级别的内容，比如 header、tabs、settings、全局 dialog 等，也不需要再套一层 `ToolShell`。

推荐基础结构（2D 预览工具）：

```svelte
<script lang="ts">
  import { LeftPanel, PreviewCanvas, RightPanel, Section } from '$lib/components/shell/index.js';
</script>

<LeftPanel>
  <Section title="Controls">
    <!-- 参数区内容 -->
  </Section>

  <Section title="Advanced" collapsible>
    <!-- 可折叠高级设置 -->
  </Section>
</LeftPanel>

<RightPanel>
  <PreviewCanvas contentWidth={640} contentHeight={360} label="Preview">
    <!-- 预览内容 -->
  </PreviewCanvas>
</RightPanel>
```

推荐基础结构（全出血场景，如 WebGL/视频）：

```svelte
<script lang="ts">
  import { LeftPanel, FullStage, RightPanel, Section } from '$lib/components/shell/index.js';
</script>

<LeftPanel>
  <Section title="Controls">
    <!-- 参数区内容 -->
  </Section>
</LeftPanel>

<RightPanel>
  <FullStage>
    <!-- WebGL canvas 或全屏交互内容 -->
  </FullStage>
</RightPanel>
```

推荐基础结构（自由内容）：

```svelte
<script lang="ts">
  import { LeftPanel, RightPanel, Section } from '$lib/components/shell/index.js';
</script>

<LeftPanel>
  <Section title="Controls">
    <!-- 参数区内容 -->
  </Section>
</LeftPanel>

<RightPanel>
  <!-- 任意自定义内容，无缩放/平移/棋盘格 -->
</RightPanel>
```

注意：`LeftPanel` 已经自动包含 `MainInfo`。它会从 `metadata.json` 读取 title 和 desc，所以你不需要也不应该在左侧顶部再写一次标题和描述。

### `components/`

`components/` 是当前 tool 的私有子组件目录。适合放这里的内容包括：

- 参数输入组，例如宽高输入、颜色输入、开关组
- 预设选择器，例如 preset grid、ratio picker
- 预览片段，例如静态 frame、卡片预览、导出预览
- 运行时宿主，例如 canvas host、WebGL host、SVG stage
- 局部状态块，例如统计区、空态块

不适合放进这里的内容包括：

- 准备在多个 tool 之间复用的基础 UI 原语
- 和其他 tool 互相 import 的公共组件
- 额外的 root-level 入口组件

## 完整创建步骤

### 第一步：确定 `tool-id` 和显示名

先定两个名字：

- 目录 id：kebab-case，例如 `frame-label`
- 用户可见名称：英文名称，例如 `Frame Label`

`tool-id` 会成为 hash route id，所以定了就不要随意改。

### 第二步：建立目录骨架

```text
src/tools/frame-label/
├── metadata.json
├── index.ts
├── FrameLabel.svelte
└── components/
```

### 第三步：填写 `metadata.json`

```json
{
  "name": "Frame Label",
  "desc": "Add a short label to a fixed-size preview frame.",
  "tag": ["example", "starter", "preview"],
  "version": "1.0.0",
  "enabled": true
}
```

### 第四步：编写 `index.ts`

如果 tool 不需要 heavy tech stack：

```ts
import metadata from './metadata.json';
import type { ToolDefinition } from '$lib/types/tool';

const definition = {
  metadata,
  loadComponent: () => import('./FrameLabel.svelte')
} satisfies ToolDefinition;

export default definition;
```

如果需要 Three.js：

```ts
import metadata from './metadata.json';
import type { ToolDefinition } from '$lib/types/tool';

const definition = {
  metadata,
  techStack: ['three'],
  loadComponent: () => import('./ThreeScene.svelte')
} satisfies ToolDefinition;

export default definition;
```

### 第五步：编写 master `.svelte`

直接参考本指南顶部的最小示例，或者复制 `src/tools/hello-world/` 作为起点。

### 第六步：拆分私有子组件

如果逻辑开始变复杂，或者预览和控制逻辑开始耦合，就把相关部分移进 `components/`。

### 第七步：运行构建验证

```bash
npm run build
```

构建通过就意味着 tool 已经自动出现在 catalog 里了。

## 选择右侧呈现模式

工具可以从三种右侧面板呈现模式中选择：

| 模式 | 适用场景 | 提供的能力 |
| --- | --- | --- |
| `PreviewCanvas` | 固定尺寸的 2D 内容预览 | 缩放/适配/平移、棋盘格背景、工具栏 |
| `FullStage` | WebGL、视频、全屏交互 | 全出血容器，工具自行管理全部交互 |
| 自由内容 | 列表、表格、文档等 | 无框架预设，完全自定义 |

## 接入 PreviewCanvas

`PreviewCanvas` 是 framework 提供的可选 2D 预览舞台。它内置了 Fit、1:1、缩放和平移功能。适用于有明确宽高的固定画布内容。

基础用法：

```svelte
<RightPanel>
  <PreviewCanvas contentWidth={640} contentHeight={360} label="Card Preview">
    <div class="my-preview">
      <!-- 你的预览内容 -->
    </div>
  </PreviewCanvas>
</RightPanel>
```

关键 props：

| Prop | 类型 | 说明 |
| --- | --- | --- |
| `contentWidth` | `number` | 逻辑内容宽度，单位 px |
| `contentHeight` | `number` | 逻辑内容高度，单位 px |
| `label` | `string` | 工具栏左侧的英文标签 |
| `actions` | `Snippet` | 可选，在工具栏缩放控制后渲染额外控件 |

约束：

- 子内容默认占满 `100%` 宽高
- 缩放、平移、Fit 和 1:1 交给 `PreviewCanvas`
- 不要在子内容里再造一套预览工具栏

如果需要在工具栏中添加自定义控件（例如网格开关），使用 `actions` snippet：

```svelte
<PreviewCanvas contentWidth={640} contentHeight={360} label="Layout Preview">
  {#snippet actions()}
    <Button variant="ghost" size="sm" onclick={toggleGrid}>Grid</Button>
  {/snippet}
  <div class="my-preview"><!-- 内容 --></div>
</PreviewCanvas>
```

## 接入 FullStage

`FullStage` 是 framework 提供的最小化全出血容器。适用于 WebGL 渲染器、视频播放器或任何需要占满整个右侧面板区域的场景。

FullStage 不提供缩放控制、工具栏或背景装饰——工具自行管理一切。

基础用法：

```svelte
<RightPanel>
  <FullStage>
    <MyWebGLViewport />
  </FullStage>
</RightPanel>
```

关键特性：

- `flex: 1` 填满整个右侧面板
- `overflow: hidden` 防止内容溢出
- `position: relative` 支持绝对定位子元素（如悬浮 HUD）
- 不做任何视觉装饰

对于 WebGL 或 canvas 宿主，推荐方式是在 `FullStage` 内部渲染一个占满的宿主元素，用 `ResizeObserver` 监听尺寸，再把渲染器绑定到宿主 DOM。完整参考见 `src/tools/three-cube/components/CubeViewport.svelte`。

## 使用 Heavy Tech Stack

当 tool 需要用到 Three.js、Pixi.js 或 GSAP 时，有一套固定流程必须遵守。

顶层页面的装载顺序是：

1. 调用 `loadToolDefinition(activeToolId)`
2. 读取 `definition.techStack`
3. 调用 `loadTechStacks(definition.techStack)`
4. 调用 `definition.loadComponent()`
5. 在 `ToolShell` 内挂载组件

这意味着，只要在 `index.ts` 中声明了 `techStack`，framework 就会先把对应 heavy 依赖预热好，再挂载组件。

第一步，在 `index.ts` 中声明：

```ts
const definition = {
  metadata,
  techStack: ['three'],
  loadComponent: () => import('./ThreeCube.svelte')
} satisfies ToolDefinition;
```

第二步，在组件内部通过 shared loader 获取：

```ts
import { loadTechStack } from '$lib/runtime/tech-stack';

const THREE = await loadTechStack('three');
```

loader 内部带缓存，因此顶层预加载和组件内调用都是安全的。不要直接把 heavy dependency 接进共享 shell 层，也不要绕过 loader 另起一套缓存。

## Bits UI 约束

交互型基础组件默认优先使用共享包装。只有在共享 UI 层还没有对应组件，或者该交互非常 tool-specific 时，才建议在私有组件里直接使用 Bits UI。

即便直接使用，也必须遵守下面两条。

### delegated element 必须完整透传 `props`

```svelte
{#snippet child({ props })}
  <button {...props} class="my-button">
    Click me
  </button>
{/snippet}
```

不要只挑部分属性透传，也不要丢掉事件、ARIA、ref 等 Bits UI 注入属性。

### 浮动内容必须保留双层结构

对 dropdown、popover、dialog 这类浮动内容，必须保留：

- 外层 `...wrapperProps`
- 内层 `...props`

并且视觉样式只写在内层，不写在外层。

```svelte
{#snippet child({ wrapperProps, props, open })}
  {#if open}
    <div {...wrapperProps}>
      <div {...props} class="dropdown-menu__content">
        <!-- styled content -->
      </div>
    </div>
  {/if}
{/snippet}
```

## 组织 master `.svelte` 的建议

左侧参数区推荐按这个顺序排布：

1. 核心输入
2. 常用预设
3. 派生结果或当前状态
4. 高级设置
5. 辅助说明

优先使用共享布局组件：

- `LeftPanel`
- `Section`

如果需要交互控件，优先使用共享 UI 包装：

- `Button`
- `Dialog`
- `DropdownMenu`
- `Collapsible`
- `Tabs`

当前可直接复用的共享类来自 `src/app.css`：

- `.pixel-input`
- `.pixel-chip`
- `.pixel-frame`
- `.pixel-scrollbar`
- `.pixel-checkerboard`

样式约束：

- 统一使用 CSS Custom Properties
- 间距、字号、边框一律使用 px 单位
- 不使用 Tailwind class，不使用 rem-based 体系

推荐用 tool id 作为 CSS 类名前缀，避免不同 tool 的样式碰撞：

```css
.frame-label__field { ... }
.frame-label__preview { ... }
.frame-label__badge { ... }
```

### `menuActions` 的位置

`menuActions` 会显示在 `MainInfo` 的菜单中，但目前顶层 runtime 还没有把 action 回调交还给 tool。可以把它当成展示层预留位，但核心交互仍应放在左侧参数区或右侧预览区。

## 禁止事项

新增 tool 时，以下行为一律不允许：

- 在 master `.svelte` 里重写 workspace shell，例如 header、tabs、settings、help、about
- 在 `metadata.json` 中放 runtime 逻辑，例如 `techStack`、`loadComponent`、组件路径
- 在工具根目录放多个 `.svelte`
- 未在 `index.ts` 声明 `techStack` 就直接使用 `three`、`pixi` 或 `gsap`
- 使用 Tailwind utility class 或重新引入 Tailwind 依赖
- 使用 rem-based 自适应体系替代当前 px + CSS Custom Properties 体系
- 在共享 UI 文案中写中文
- 在 tool 内单独实现 `<720px` 视口 fallback
- 手动修改 registry 文件来注册 tool

## 常见错误

### 把 shell 写进 tool

错误表现：在 master `.svelte` 里写了一层 header，或者自己实现了 tabs、workspace grid。

正确做法：tool 只渲染 `<LeftPanel>` 和 `<RightPanel>` 内的内容，顶层壳层完全交给 framework。

### 在 `metadata.json` 放 runtime 字段

错误表现：

```json
{
  "name": "My Tool",
  "techStack": ["three"],
  "loadComponent": "./MyTool.svelte"
}
```

正确做法：`metadata.json` 只保留静态字段：`name`、`desc`、`tag`、`version`，以及可选的 `enabled`；其余都放在 `index.ts`。

### 使用 `enabled: false` 的语义

错误理解：把 `enabled: false` 当成“只是不在工具架显示”。

正确语义：`enabled: false` 是硬开关。工具会同时从工具架、合法 tool id 集合、hash 路由激活和本地持久化恢复中被排除。

### 根目录放多个 `.svelte`

错误表现：

```text
src/tools/my-tool/
├── MyTool.svelte
├── Preview.svelte
├── Controls.svelte
├── metadata.json
└── index.ts
```

正确做法：

```text
src/tools/my-tool/
├── MyTool.svelte
├── metadata.json
├── index.ts
└── components/
    ├── Preview.svelte
    └── Controls.svelte
```

### 使用 heavy dependency 但没声明 `techStack`

错误表现：

```ts
import * as THREE from 'three';
```

正确做法：

1. 在 `index.ts` 声明 `techStack: ['three']`
2. 在组件内通过 `loadTechStack('three')` 获取模块

### 忘记 `LeftPanel` 已自带 `MainInfo`

错误表现：左侧顶部又手写了一块标题、描述和菜单，元数据重复出现两份。

正确做法：只写自己的 `Section` 内容；要改标题或描述，就去改 `metadata.json`。

### Bits UI child snippet 没有完整透传

错误表现：`props` 只传了一部分，或者浮层内容丢掉了 `wrapperProps`，或者把视觉样式写在了外层 wrapper 上。

正确做法：delegated element 完整透传 `...props`；浮层保留 `wrapperProps + props` 双层；外层不承载视觉样式。

### 忘记 `export default`

错误表现：`index.ts` 定义了 `definition` 却没有 `export default definition`，导致 runtime 加载不到合法 definition。

正确做法：文件末尾必须 `export default definition`。

## 开发完成后的自检清单

- [ ] 目录名使用 kebab-case，可直接作为 runtime id 和 hash route id
- [ ] 根目录只有一个 master `.svelte`
- [ ] 所有其他私有 `.svelte` 都放在 `components/`
- [ ] `metadata.json` 只包含静态字段：`name`、`desc`、`tag`、`version`，以及可选 `enabled`
- [ ] `metadata.json` 中所有文案均为英文
- [ ] `index.ts` 使用 `satisfies ToolDefinition`
- [ ] `index.ts` 末尾有 `export default definition`
- [ ] `loadComponent` 使用懒加载，而不是顶部 import
- [ ] 若使用 `three`、`pixi` 或 `gsap`，已在 `index.ts` 声明 `techStack`
- [ ] heavy dependency 通过 `loadTechStack` 获取，没有直接接进共享 shell
- [ ] master `.svelte` 没有重复写 workspace shell
- [ ] `LeftPanel` 中没有重写 `MainInfo`
- [ ] 右侧预览接入了 `PreviewCanvas`
- [ ] `contentWidth` 和 `contentHeight` 使用了真实逻辑尺寸
- [ ] 样式只使用 CSS Custom Properties 和 px 单位，没有 Tailwind class
- [ ] 如使用 Bits UI child snippet，已完整透传 `props`
- [ ] 如使用浮动层，已保留 `wrapperProps + props` 双层结构
- [ ] 执行 `npm run build` 通过

## 附录：运行时发现机制

`src/lib/runtime/tool-registry.ts` 中当前采用两段式发现：

```ts
const metadataModules = import.meta.glob('/src/tools/*/metadata.json', { eager: true });
const definitionModules = import.meta.glob('/src/tools/*/index.ts');
```

这种分离设计的结果是：

- 打开 Open Tool 列表时不需要加载任何组件代码，catalog 只依赖静态 JSON
- 选中某个 tool 时，才真正加载它的 `index.ts`、tech stack 和组件
- `tool-id` 直接从目录路径中提取，不需要额外注册

一个 tool 能被 runtime 自动发现，必须同时满足三条：

1. 目录位于 `src/tools/<tool-id>/`
2. 目录下存在 `metadata.json`
3. 目录下存在 `index.ts`，并导出合法的 `ToolDefinition`

满足这三条，tool 就会自动出现在 workspace 的 Open Tool 列表中。