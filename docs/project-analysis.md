# Marble Design Toolset 项目分析

## 1. 项目概述

### 1.1 项目定位
Marble Design Toolset 是一个基于 SvelteKit 构建的 Pixel Tool Framework，旨在为多个像素风设计工具提供统一的承载平台。该项目采用现代化的前端架构，通过框架化设计实现工具模块的即插即用。

### 1.2 核心价值
- **统一化体验**：所有工具共享一致的 workspace 界面和交互模式
- **模块化扩展**：工具以独立模块形式存在，易于开发、测试和部署
- **技术栈隔离**：重型技术栈按需加载，避免基础框架臃肿
- **设计规范**：建立了完整的像素风 UI 设计系统和开发规范

### 1.3 项目状态
当前处于框架建立阶段，已完成核心架构设计、基础组件系统、工具运行时和三个示例工具的实现。

---

## 2. 技术栈分析

### 2.1 核心框架
| 技术 | 版本 | 用途 |
|------|------|------|
| Svelte | 5.55.2 | 响应式 UI 框架，采用 Runes 风格 |
| SvelteKit | 2.57.0 | 全栈应用框架，提供路由、构建等能力 |
| Vite | 8.0.7 | 构建工具，提供快速的开发体验 |

### 2.2 UI 与交互
| 技术 | 版本 | 用途 |
|------|------|------|
| Bits UI | 2.17.3 | 无头交互组件库，提供 Button、Dialog、Dropdown 等原子组件 |
| pixelarticons | 2.0.2 | 像素风格图标库 |

### 2.3 重型技术栈（按需加载）
| 技术 | 版本 | 用途 |
|------|------|------|
| Three.js | 0.183.2 | 3D 渲染引擎 |
| Pixi.js | 8.17.1 | 2D WebGL 渲染引擎 |
| GSAP | 3.14.2 | 专业动画库 |

### 2.4 技术选型特点
- **轻量化基础**：核心框架仅保留必要依赖
- **按需加载**：重型技术栈通过 runtime 动态导入
- **无头组件**：Bits UI 提供交互逻辑，样式完全自主控制
- **无 CSS 框架**：放弃 Tailwind，使用 CSS Custom Properties 实现设计系统

---

## 3. 架构设计与分层

### 3.1 总体架构图
```
Application Workspace
├── Workspace Shell
│   ├── Header / Tabs / Dialogs / Settings
│   ├── LeftPanel / RightPanel / MainInfo / Section
│   └── Preview Canvas / Zoom / Grid
├── UI Foundation
│   ├── CSS Tokens
│   ├── Bits UI Wrappers
│   ├── Pixel Icons
│   └── Border Assets
├── Tool Runtime
│   ├── Tool Registry
│   ├── Hash Routing
│   ├── Tab State / Persistence
│   └── Tech Stack Loader
└── Tool Modules
    ├── metadata.json
    ├── index.ts
    ├── Master .svelte
    └── private components/
```

### 3.2 分层职责

#### 3.2.1 UI Foundation（像素 UI 基础层）
- **CSS Tokens**：全局设计令牌，定义颜色、间距、字体等
- **Bits UI Wrappers**：对无头组件的项目化包装
- **Pixel Assets**：像素风格图标和边框资源
- **Viewport Guard**：横屏保护，小屏阻断

#### 3.2.2 Workspace Shell（工具壳层）
- **Header**：应用标题、Open、Help、Settings 按钮
- **Tab System**：工具标签管理，支持打开/关闭/恢复
- **ToolShell**：左右分栏布局容器
- **LeftPanel**：工具参数区承载
- **RightPanel**：预览区承载
- **PreviewCanvas**：带缩放、平移、Fit/1:1 功能的画布

#### 3.2.3 Tool Runtime（工具运行时）
- **Metadata Discovery**：通过 `import.meta.glob` 自动发现工具
- **Tool Registry**：工具定义注册与管理
- **Runtime Loader**：懒加载工具组件
- **Hash Route Sync**：URL hash 与活动工具同步
- **Workspace Persistence**：localStorage 状态持久化
- **Tech Stack Registry**：three/pixi/gsap 动态导入与缓存

#### 3.2.4 Tool Modules（工具模块）
每个工具是独立模块，只负责：
- 左侧参数 UI
- 右侧预览逻辑
不负责全局壳层布局。

### 3.3 数据流向
```
User Interaction → Tab State → Tool Loader → Component Mount → Tech Stack Inject
                                                         ↓
                                                  Preview Update
```

---

## 4. 核心功能模块

### 4.1 工具发现与注册系统
**位置**：`src/lib/runtime/tool-registry.ts`

通过 `import.meta.glob`  eager 模式扫描 `src/tools/*/metadata.json`，自动构建工具目录。每个工具无需手动注册。

### 4.2 技术栈按需加载
**位置**：`src/lib/runtime/tech-stack.ts`

工具在 `index.ts` 中声明需要的技术栈：
```typescript
techStack: ['three', 'gsap']
```
运行时自动预加载并注入到工具上下文中，避免未使用的技术栈增加包体积。

### 4.3 状态持久化
**位置**：`src/lib/runtime/workspace-state.ts`

持久化内容：
- 打开的工具列表
- 活动工具 ID
- 左侧面板宽度
- 设置对话框状态

### 4.4 视口防护
当视口宽度 < 720px 时，阻止正常工作区渲染，显示提示页面，确保纯横屏体验。

---

## 5. 开发规范与约束

### 5.1 样式规范
- ❌ 禁止使用 TailwindCSS
- ✅ 统一使用 CSS Custom Properties
- ✅ 尺寸单位统一使用 `px`
- ✅ 缩放依赖浏览器缩放行为
- ✅ 基于 2px 网格的间距系统

### 5.2 组件规范
**交互型组件（基于 Bits UI）**：
- Button、Dialog、DropdownMenu、Popover、Collapsible、Tabs

**布局型组件（手写）**：
- ToolShell、LeftPanel、RightPanel、MainInfo、Section、PreviewCanvas

**Bits UI 使用规则**：
- 自定义元素必须完整透传 `{...props}`
- 浮动内容保留 `{...wrapperProps}` + `{...props}` 双层结构
- 外层不承载视觉样式

### 5.3 目录规范

#### 5.3.1 共享组件
```
src/lib/components/
├── shell/
│   ├── tool-shell/
│   ├── left-panel/
│   ├── right-panel/
│   ├── main-info/
│   ├── section/
│   └── preview-canvas/
└── ui/
    ├── button/
    ├── dialog/
    ├── dropdown-menu/
    ├── collapsible/
    ├── tabs/
    └── pixel-icon/
```

#### 5.3.2 工具模块
```
src/tools/{tool-id}/
├── index.ts          # 运行时定义
├── metadata.json     # 静态元数据
├── {ToolName}.svelte # 唯一主入口组件
└── components/       # 私有子组件
    └── ...
```

**命名规则**：
- `tool-id`：kebab-case
- 主组件：PascalCase（与 tool-id 对应）
- 根目录只允许一个 `.svelte`

### 5.4 Tool Runtime 合约

**metadata.json**：
```json
{
  "name": "Tool Name",
  "desc": "Description",
  "tag": ["tag1", "tag2"],
  "version": "1.0.0"
}
```

**index.ts**：
```typescript
import metadata from './metadata.json';
import type { ToolDefinition } from '$lib/types/tool';

const definition = {
  metadata,
  menuActions: [{ id: 'about', label: 'About' }],
  techStack: ['gsap'],
  loadComponent: () => import('./AspectRatio.svelte')
} satisfies ToolDefinition;

export default definition;
```

### 5.5 视觉约束
- 主基调：暗蓝灰专业设计工具风格
- 强调色：紫色
- 字体：monospace（过渡方案）
- 图标：pixelarticons raw SVG
- 边框：SVG border-image
- 文案：仅英文
- 布局：纯横屏，不做竖屏适配

---

## 6. 现有工具示例分析

### 6.1 hello-world
**位置**：`src/tools/hello-world/`

**特点**：
- 最小可运行示例
- 无外部依赖
- 展示基本的 LeftPanel + RightPanel 结构

**用途**：作为新工具的模板起点。

### 6.2 aspect-ratio
**位置**：`src/tools/aspect-ratio/`

**特点**：
- 参数型工具示例
- 使用 Section 组件组织参数区
- 展示响应式预览更新
- 可能使用 GSAP 做动效

**用途**：展示如何构建带表单参数的设计工具。

### 6.3 three-cube
**位置**：`src/tools/three-cube/`

**特点**：
- 重型技术栈使用示例
- 声明 `techStack: ['three']`
- 在 PreviewCanvas 中渲染 3D 内容
- 展示技术栈按需加载机制

**用途**：展示如何集成和使用 Three.js 等重型库。

---

## 7. 设计系统详解

### 7.1 CSS Tokens（设计令牌）
**位置**：`src/app.css`

**颜色系统**：
```css
--color-bg-base: #1e1e2e;
--color-bg-surface: #252535;
--color-bg-elevated: #2d2d3f;
--color-fg-primary: #e0e0e8;
--color-fg-secondary: #a0a0b0;
--color-border: #3a3a4a;
--color-accent: #9580ff;
--color-danger: #e5534b;
--color-success: #57ab5a;
```

**间距系统（2px 网格）**：
```css
--space-1: 2px;
--space-2: 4px;
--space-3: 8px;
--space-4: 16px;
--space-5: 24px;
--space-6: 32px;
```

**字体系统**：
```css
--font-size-1: 10px;
--font-size-2: 12px;
--font-size-3: 14px;
--font-size-4: 16px;
--font-size-5: 20px;
```

### 7.2 布局约定
- LeftPanel：默认 `flex-direction: column`，常规区块 gap 为 8px
- Section 内部：使用 4px、8px、16px 三个常见层级
- Canvas 区域之外：保持低刺激、长时间工作友好

---

## 8. 项目价值与应用场景

### 8.1 项目价值
1. **框架复用**：避免每个设计工具重复构建 workspace 壳层
2. **规范统一**：通过强约束确保所有工具体验一致
3. **技术隔离**：工具可以使用不同技术栈，互不干扰
4. **扩展友好**：新工具只需遵循目录规范，自动集成

### 8.2 适用工具类型
- 像素画编辑器
-  Spritesheet 工具
- 动画时间轴编辑器
- 字体设计工具
- 调色板生成器
- 3D 像素模型预览器
- 任何需要左右分栏 + 预览的设计工具

### 8.3 技术优势
- **Svelte 5 Runes**：现代化响应式，代码简洁
- **按需加载**：首屏加载快，工具切换按需加载
- **无头组件**：交互逻辑与视觉完全分离
- **TypeScript**：完整类型定义，开发体验好
- **静态构建**：可部署到任何静态托管

---

## 9. 总结

Marble Design Toolset 是一个设计精良的像素风工具框架，通过清晰的分层、严格的规范、灵活的扩展机制，为多个设计工具提供了统一的承载平台。其核心价值在于将重复的 workspace 壳层、状态管理、技术栈加载等工作抽象为框架能力，让工具开发者专注于业务逻辑本身。

该项目适合作为：
- 像素风设计工具套件的基础框架
- Svelte 5 架构实践的参考项目
- 无头组件 + CSS 设计系统的学习案例
