# CSS 样式指南

> 如何在 Marble Design Toolset 框架中为组件编写样式。

本指南涵盖样式系统、Bits UI 集成模式，以及面向 tool 作者和框架贡献者的实践技巧。

## 目录

- [设计 Token 系统](#设计-token-系统)
- [为 Bits UI 组件编写样式](#为-bits-ui-组件编写样式)
- [`child` Snippet 模式](#child-snippet-模式)
- [创建带样式的包装组件](#创建带样式的包装组件)
- [Tool 作用域样式](#tool-作用域样式)
- [实用工具类](#实用工具类)
- [常见陷阱](#常见陷阱)
- [实践示例](#实践示例)

---

## 设计 Token 系统

所有视觉样式均由定义在 `src/app.css` 的 `:root` 上的 CSS Custom Properties 驱动。项目不使用任何 CSS 框架，所有尺寸均以 `px` 为单位。

### 颜色 Token

背景层从最暗到最亮依次递进：

| Token | 值 | 用途 |
|---|---|---|
| `--color-bg-app` | `oklch(0.085 0.024 264)` | 页面级背景（基准色） |
| `--color-bg-panel` | `oklch(from --bg-app l+0.030 c h)` | 面板/组件背景 |
| `--color-bg-surface` | `oklch(from --bg-app l+0.080 c h)` | 浮层表面、对话框 |
| `--color-bg-elevated` | `oklch(from --bg-app l+0.130 c h)` | 按钮、输入框静止状态 |
| `--color-bg-inset` | `oklch(from --bg-app l+0.095 c+0.014 h)` | 凹陷区域、输入字段 |
| `--color-bg-muted` | `oklch(from --bg-app l+0.120 c+0.021 h)` | 低调交互区域 |
| `--color-bg-highlight` | `oklch(from --color-accent l c h / 14%)` | 悬停高亮 |

前景色 Token：

| Token | 用途 |
|---|---|
| `--color-fg-primary` | 主文本、标题 |
| `--color-fg-secondary` | 辅助文本、标签 |
| `--color-fg-muted` | 占位符文本、元数据 |

语义色 Token：

| Token | 用途 |
|---|---|
| `--color-accent` | 主强调色（oklch(0.610 0.185 291) 紫色） |
| `--color-accent-soft` | 浅色强调变体 |
| `--color-danger` | 错误/破坏性操作 |
| `--color-success` | 成功状态 |

边框色 Token：

| Token | 用途 |
|---|---|
| `--color-border-strong` | 可见边框 |
| `--color-border-soft` | 细微分割线 |
| `--color-border-focus` | 焦点环 |

### 间距 Token

基于 2px 网格：

```css
--space-1: 2px;   /* 极细间隙 */
--space-2: 4px;   /* 紧凑间距 */
--space-3: 8px;   /* 默认内边距 */
--space-4: 12px;  /* 区域内边距、工具栏间距 */
--space-5: 16px;  /* 面板内边距 */
--space-6: 24px;  /* 大区域间距 */
--space-7: 32px;  /* 主要布局间距 */
```

### 字体 Token

```css
--font-family-base: 'Mono10', 'Noto Sans SC', monospace;
--font-size-1: 10px;  /* 标签、徽章、元数据 */
--font-size-2: 12px;  /* 正文（默认） */
--font-size-3: 14px;  /* 强调正文 */
--font-size-4: 16px;  /* 副标题 */
--font-size-5: 20px;  /* 标题 */
```

### 边框与圆角 Token

```css
--border-width-outer: 4px;  /* 像素帧边框 */
--border-width-inner: 2px;  /* 输入框/按钮边框 */
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
--pixel-border-source: url('./lib/assets/ui/pixel-border.svg');
```

### 动画 Token

```css
--duration-fast: 120ms;   /* 悬停、颜色过渡 */
--duration-base: 180ms;   /* 标准过渡 */
--duration-slow: 260ms;   /* 复杂动画 */
--easing-standard: cubic-bezier(0.22, 1, 0.36, 1);
```

### 何时创建新 Token vs 复用现有 Token

**复用**的情形：
- 已有 token 在语义上与你的意图匹配（例如，对任何类按钮元素使用 `--color-bg-elevated`）。
- 间距符合 2px 网格——选择最接近的 `--space-*` token。

**创建新 Token** 的情形：
- tool 需要局部作用域的强调色（在 tool 根元素上使用 CSS 变量）。
- 某个组件有反复出现的魔法值，且现有 token 在语义上无法覆盖。

项目级新 token 添加到 `src/app.css` 的 `:root` 下。tool 局部 token 放在 tool 的 `<style>` 块中，使用作用域自定义属性（参见 [Tool 作用域样式](#tool-作用域样式)）。

---

## 为 Bits UI 组件编写样式

Bits UI 是一个**无头**组件库。它只提供行为（键盘导航、ARIA 属性、焦点管理），**不提供任何视觉样式**。项目将每个 Bits UI 原语包装成带样式的组件，统一放置在 `src/lib/components/ui/` 下。

### 通过 `data-*` 属性定位组件状态

Bits UI 通过渲染 DOM 元素上的 `data-*` 属性暴露组件状态。当你需要响应**组件级**状态（而非仅指针状态）时，应使用这些属性，而非 `:hover`/`:focus` 伪类。

常用属性：

| 属性 | 含义 | 使用组件 |
|---|---|---|
| `[data-highlighted]` | 条目被键盘聚焦或鼠标悬停 | DropdownMenu.Item |
| `[data-disabled]` | 组件被禁用 | Button、Item |
| `[data-state="open"]` | 折叠/可折叠内容已展开 | Collapsible、Dialog |
| `[data-state="closed"]` | 折叠/可折叠内容已收起 | Collapsible、Dialog |

示例——为键盘高亮的下拉菜单项编写样式：

```css
.dropdown-menu__item[data-highlighted] {
  background: rgba(149, 128, 255, 0.16);
  color: var(--color-fg-primary);
  outline: none;
}

.dropdown-menu__item[data-disabled] {
  opacity: 0.45;
  cursor: default;
}
```

### 在 Bits UI 元素上使用基于类名的样式

当 Bits UI 渲染原生元素（如 `<button>`）时，可以直接传递 `class` prop：

```svelte
<BitsButton.Root class="button button--solid button--md">
  Click me
</BitsButton.Root>
```

对于默认不渲染 DOM 元素、使用 `child` snippet 模式的组件，应将类名应用到你自己的自定义元素上（见下一节）。

---

## `child` Snippet 模式

Bits UI 组件接受可选的 `child` snippet，让你用自己的元素替换默认渲染的元素。以下场景需要使用此模式：

- 自定义 HTML 元素（例如用 `<a>` 替代 `<button>`）
- 完全掌控 DOM 结构
- 使用 Svelte 过渡动画或 GSAP 动画（需要 `forceMount`）

### 基础 `child` Snippet

`child` snippet 接收 `props`，**必须**将其展开到你的自定义元素上：

```svelte
<BitsDialog.Close>
  {#snippet child({ props })}
    <button
      {...props}
      type="button"
      class="dialog__close"
      aria-label="Close"
    >
      <PixelIcon name="cancel" size={14} />
    </button>
  {/snippet}
</BitsDialog.Close>
```

**关键规则**：始终展开 `{...props}`。这包含 ARIA 属性、事件处理器和 `data-*` 状态属性。省略 `{...props}` 会破坏无障碍性和组件行为。

### 浮层内容：双层模式

使用 `forceMount` 的浮层组件（DropdownMenu.Content、Popover.Content、Dialog.Content 遮罩层）会接收**两组** props：

- `wrapperProps` — 用于**外层**容器的定位/portal props
- `props` — 用于**内层**内容的语义/无障碍 props

**外层包装器绝对不能承载视觉样式。**它仅用于 Floating UI 的定位。

```svelte
<BitsDropdownMenu.Content forceMount {align} {side} {sideOffset}>
  {#snippet child({ wrapperProps, props, open })}
    {#if open}
      <div {...wrapperProps}>
        <div {...props} class="dropdown-menu__content">
          <!-- 在此处放置带样式的内容 -->
        </div>
      </div>
    {/if}
  {/snippet}
</BitsDropdownMenu.Content>
```

为什么需要 `{#if open}`？使用 `forceMount` 时，Bits UI 会始终将组件保留在 DOM 中。`{#if}` 根据 `open` 状态控制可见性。这样就能支持 Svelte 过渡动画：

```svelte
{#snippet child({ wrapperProps, props, open })}
  {#if open}
    <div {...wrapperProps}>
      <div {...props} class="dropdown-menu__content" transition:fly={{ y: -4, duration: 120 }}>
        <!-- 内容 -->
      </div>
    </div>
  {/if}
{/snippet}
```

### 遮罩层模式

遮罩层（Dialog 背景）使用单层 `child` snippet，因为它不需要浮层定位：

```svelte
<BitsDialog.Overlay forceMount>
  {#snippet child({ props, open: isOpen })}
    {#if isOpen}
      <div {...props} class="dialog__overlay"></div>
    {/if}
  {/snippet}
</BitsDialog.Overlay>
```

---

## 创建带样式的包装组件

每个 Bits UI 原语在 `src/lib/components/ui/` 中只包装一次，tool 从这些包装组件导入——永远不直接使用 Bits UI。

### 逐步操作：包装 Bits UI 原语

以 `Button` 作为参考实现：

**1. 定义 props 接口**

继承原生 HTML 属性，并添加你的变体/尺寸系统：

```svelte
<script lang="ts">
  import { Button as BitsButton } from 'bits-ui';
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  type Variant = 'solid' | 'outline' | 'ghost' | 'danger';
  type Size = 'sm' | 'md' | 'icon';

  interface Props extends HTMLButtonAttributes {
    variant?: Variant;
    size?: Size;
    class?: string;
    children?: Snippet;
  }

  let {
    variant = 'solid',
    size = 'md',
    type = 'button',
    class: className = '',
    children,
    ...rest
  }: Props = $props();
</script>
```

**2. 拼接类名字符串**

根据变体/尺寸构建类名，遵循 BEM 风格命名：

```ts
let buttonClass = $derived(
  `button button--${variant} button--${size}${className ? ` ${className}` : ''}`
);
```

**3. 用 Bits UI root 渲染，展开 rest props**

```svelte
<BitsButton.Root class={buttonClass} {type} {...rest}>
  {@render children?.()}
</BitsButton.Root>
```

**4. 当 Bits UI 拥有元素时，使用 `:global()` 编写样式**

由于 `BitsButton.Root` 渲染自己的 `<button>`，Svelte 的作用域样式无法穿透进去。需使用 `:global()`：

```css
:global(.button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: var(--border-width-inner) solid var(--color-border-soft);
  background: var(--color-bg-elevated);
  color: var(--color-fg-primary);
  font-size: var(--font-size-2);
  cursor: pointer;
  transition:
    transform var(--duration-fast) var(--easing-standard),
    background var(--duration-fast) var(--easing-standard);
}

:global(.button--solid) {
  background: #2f275a;
  border-color: #6d5ed2;
  color: #f4f0ff;
}

:global(.button--ghost) {
  background: transparent;
  border-color: transparent;
  color: var(--color-fg-secondary);
}
```

**何时使用 `:global()` vs 作用域样式：**

| 情形 | 使用方式 |
|---|---|
| Bits UI 渲染 DOM 元素（如 `BitsButton.Root`） | `:global(.class)` |
| 通过 `child` snippet 渲染自己的元素 | 作用域 `.class`（Svelte 自动处理） |
| 跨组件复用的工具类 | `app.css` 中的 `:global()` |

**5. 从 index.ts 导出**

```ts
// src/lib/components/ui/button/index.ts
export { default as Button } from './Button.svelte';
```

---

## Tool 作用域样式

### BEM 风格命名约定

每个 tool 以 tool ID 作为命名空间来限定 CSS 类名作用域：

```
.{tool-id}__{元素}
.{tool-id}__{元素}--{修饰符}
```

现有 tool 示例：

```css
/* aspect-ratio tool */
.aspect-ratio-tool__custom-fields { ... }
.aspect-ratio-tool__stat-row { ... }
.aspect-ratio-tool__stat-label { ... }

/* hello-world tool */
.hello-world__preview { ... }
.hello-world__badge { ... }
.hello-world__title { ... }

/* three-cube tool */
.three-cube__copy { ... }
.three-cube__list { ... }
```

### Tool 局部 CSS Custom Properties

在单个 tool 内进行主题定制时，在 tool 元素上定义 CSS 自定义属性，然后在子元素中使用：

```svelte
<div class="frame-label__preview" style={`--frame-label-accent: ${accent};`}>
  <div class="frame-label__badge">Preview</div>
</div>

<style>
  .frame-label__preview {
    border: 2px solid var(--frame-label-accent);
  }

  .frame-label__badge {
    color: var(--frame-label-accent);
  }
</style>
```

这种方式的优点：
- 样式可以响应用户输入的变化
- 避免污染全局 token 命名空间
- 保持在 Svelte 作用域样式系统内

### 在 Tool 样式中使用设计 Token

共享视觉方面始终引用全局 token，只在 tool 独有的视觉效果上使用原始值：

```css
/* 正确：与框架保持一致 */
.my-tool__panel {
  padding: var(--space-4);
  color: var(--color-fg-secondary);
  font-size: var(--font-size-2);
  border: var(--border-width-inner) solid var(--color-border-soft);
}

/* 可接受：tool 特有的视觉效果，没有对应 token */
.my-tool__canvas-overlay {
  background: rgba(20, 28, 43, 0.85);
}
```

---

## 实用工具类

框架在 `src/app.css` 中提供以下工具类。通过在元素上添加类名即可使用。

### `.pixel-frame`

使用 SVG `border-image` 应用标志性的像素艺术边框：

```css
.pixel-frame {
  border: var(--border-width-outer) solid transparent;
  border-image-source: var(--pixel-border-source);
  border-image-slice: 4 fill;
  border-image-width: 4px;
  border-image-repeat: stretch;
  background: var(--color-bg-surface);
  box-shadow: 0 18px 48px var(--color-shadow);
}
```

用途：应用于需要像素边框效果的面板、卡片或对话框。

```svelte
<section class="preview-canvas pixel-frame">
  ...
</section>
```

### `.pixel-scrollbar`

可滚动容器的细线条样式化滚动条：

```svelte
<div class="my-tool__list pixel-scrollbar" style="overflow-y: auto; max-height: 400px;">
  ...
</div>
```

### `.pixel-checkerboard`

带有细微内嵌阴影与网格风格背景，用于画布/预览区域：

```css
.pixel-checkerboard {
  background-color: #141c2b;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.03);
}
```

### `.pixel-input`

与框架风格匹配的全宽表单输入框：

```svelte
<input class="pixel-input" bind:value={label} placeholder="Enter value" />
```

特性：36px 高度、内嵌背景、柔和边框、焦点环、占位符样式。

### `.pixel-chip`

行内标签/徽章元素：

```svelte
<span class="pixel-chip">BETA</span>
```

特性：22px 高度、大写文本、细微强调背景色。

---

## 常见陷阱

### 禁止使用 Tailwind

不要写 `class="flex items-center gap-2"`。项目已移除所有 Tailwind 依赖。请使用设计 token 编写原生 CSS。

### 禁止使用 `rem` 或 `em` 单位

所有尺寸使用 `px`。框架不支持基于 rem 的响应式缩放。缩放交由浏览器缩放功能处理。

### 禁止引入 CSS 框架库

不要引入 Bootstrap、UnoCSS、styled-components 或类似库。样式系统仅使用 CSS Custom Properties + Svelte 作用域样式。

### 禁止与 `border-image` 系统冲突

`border-image` 属性不支持 `border-radius`。如果应用了 `.pixel-frame`，就不能在同一元素上使用 `border-radius`。如果需要圆角，请改用普通 `border`。

### 禁止覆盖壳层布局

Tool 在 `<LeftPanel>` 和 `<RightPanel>` 内渲染内容。禁止：
- 在 tool 根元素上添加 `position: fixed/absolute`
- 覆盖 ToolShell 网格
- 在 tool 根元素上设置 `overflow`
- 重新创建 header、tabs 或 workspace 结构

### 禁止为 `wrapperProps` 容器添加样式

在双层浮层模式中，外层 `<div {...wrapperProps}>` 是 Floating UI 的定位锚点。向其添加视觉样式（背景、边框、内边距）会破坏定位。

```svelte
<!-- 错误 -->
<div {...wrapperProps} class="my-menu-wrapper">

<!-- 正确 -->
<div {...wrapperProps}>
  <div {...props} class="my-menu-content">
```

### 禁止不必要地使用 `:global()`

只在 Bits UI 拥有 DOM 元素时使用 `:global()`（它自己渲染 `<button>`、`<div>` 等 Svelte 无法作用域化的元素）。当你通过 `child` snippet 渲染自己的元素时，普通作用域样式即可正常工作。

### 禁止添加 `!important`

如果你需要用 `!important` 来覆盖某个样式，说明优先级链出了问题。应修复结构，而不是依赖 `!important`。

---

## 实践示例

### 示例 1：为 Popover 包装组件编写样式

为颜色选择器创建像素风主题的 Popover：

```svelte
<!-- src/lib/components/ui/popover/Popover.svelte -->
<script lang="ts">
  import { Popover as BitsPopover } from 'bits-ui';
  import type { Snippet } from 'svelte';

  interface Props {
    trigger?: Snippet;
    children?: Snippet;
    align?: 'start' | 'center' | 'end';
    sideOffset?: number;
  }

  let { trigger, children, align = 'start', sideOffset = 8 }: Props = $props();
</script>

<BitsPopover.Root>
  <BitsPopover.Trigger>
    {#snippet child({ props })}
      <button {...props} class="popover__trigger" type="button">
        {@render trigger?.()}
      </button>
    {/snippet}
  </BitsPopover.Trigger>

  <BitsPopover.Content {align} {sideOffset} forceMount>
    {#snippet child({ wrapperProps, props, open })}
      {#if open}
        <div {...wrapperProps}>
          <div {...props} class="popover__content">
            {@render children?.()}
          </div>
        </div>
      {/if}
    {/snippet}
  </BitsPopover.Content>
</BitsPopover.Root>

<style>
  .popover__trigger {
    display: inline-flex;
    align-items: center;
    cursor: pointer;
  }

  .popover__content {
    min-width: 200px;
    padding: var(--space-4);
    border: var(--border-width-outer) solid transparent;
    border-image-source: var(--pixel-border-source);
    border-image-slice: 4 fill;
    border-image-width: 4px;
    background: var(--color-bg-surface);
    box-shadow: 0 18px 42px rgba(0, 0, 0, 0.42);
  }
</style>
```

### 示例 2：为自定义 Tool 组件应用像素主题

tool 左侧面板内的统计卡片：

```svelte
<!-- src/tools/my-tool/components/StatsCard.svelte -->
<script lang="ts">
  interface Props {
    label: string;
    value: string;
    accent?: string;
  }

  let { label, value, accent = '' }: Props = $props();
</script>

<div class="stats-card" style:--stats-accent={accent || 'var(--color-accent)'}>
  <span class="stats-card__label">{label}</span>
  <strong class="stats-card__value">{value}</strong>
  <div class="stats-card__bar"></div>
</div>

<style>
  .stats-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
    border: var(--border-width-inner) solid var(--color-border-soft);
    background: var(--color-bg-inset);
  }

  .stats-card__label {
    color: var(--color-fg-muted);
    font-size: var(--font-size-1);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .stats-card__value {
    color: var(--color-fg-primary);
    font-size: var(--font-size-4);
  }

  .stats-card__bar {
    height: 2px;
    background: var(--stats-accent);
    opacity: 0.6;
  }
</style>
```

### 示例 3：Tool 使用全局 Token 实现一致布局

tool 左侧面板中的设置区域，展示间距、字体和边框 token 的综合正确用法：

```svelte
<Section title="Export Settings" collapsible>
  <div class="export-settings">
    <label class="export-settings__field">
      <span class="export-settings__caption">Format</span>
      <select class="pixel-input" bind:value={format}>
        <option value="png">PNG</option>
        <option value="svg">SVG</option>
        <option value="pdf">PDF</option>
      </select>
    </label>

    <label class="export-settings__field">
      <span class="export-settings__caption">Scale</span>
      <input class="pixel-input" type="number" min="1" max="4" bind:value={scale} />
    </label>

    <div class="export-settings__note">
      <span class="pixel-chip">TIP</span>
      Use 2x or higher for retina displays.
    </div>
  </div>
</Section>

<style>
  .export-settings {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .export-settings__field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .export-settings__caption {
    color: var(--color-fg-secondary);
    font-size: var(--font-size-1);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .export-settings__note {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3);
    background: rgba(149, 128, 255, 0.06);
    color: var(--color-fg-muted);
    font-size: var(--font-size-1);
  }
</style>
```
