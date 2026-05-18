# Marble Design Toolset

Marble Design Toolset 是一个基于 SvelteKit 的多工具设计工作区，用来承载多个横屏设计工具。当前工作区已经提供统一的 workspace shell、tool runtime、public SDK、共享 UI 包装层以及按需 tech stack 加载机制。

## 文档入口

| 读者 | 文档路径 |
|---|---|
| Tool developer（创建或维护工具） | [`docs/for-tool-developers/`](./docs/for-tool-developers/overview.md) |
| Framework developer（维护框架本身） | [`docs/for-framework-developers/`](./docs/for-framework-developers/overview.md) |

## 开发命令

```bash
bun run create:tool   # 交互式创建新 tool
npm run dev           # 开发服务器
npm run build         # 生产构建（含 contract validation）
npm run test          # 全量测试
npm run preview       # 预览生产构建
```

## 创建新 Tool

最短路径：选择最接近目标的 capability recipe，生成能运行的 wiring，再替换成自己的业务逻辑。

```bash
bun run create:tool
```

该命令交互式询问 tool name 和 capability recipe：

| Recipe | 适用场景 |
|---|---|
| `preview-basic` | 固定尺寸预览、参数面板、纯 DOM/SVG/Canvas |
| `source-preview` | 需要导入本地图像、影片或文字文件 |
| `pixi-preview` | PixiJS 2D 渲染、纹理、粒子或滤镜 |
| `three-stage` | Three.js / WebGL 全出血舞台 |
| `preview-export` | 需要导出预览图的固定尺寸工具 |
| `custom` | 手动选择 starter 和 tech stack |

生成后运行 `npm run build` 做校验。详见 [`docs/for-tool-developers/create-a-tool.md`](./docs/for-tool-developers/create-a-tool.md)。

## 框架约束

- 不使用 Tailwind，统一使用 CSS Custom Properties 和 px 单位
- 共享 UI 文案使用英文；应用按纯横屏设计
- Tool 必须遵循 `src/tools/<tool-id>/metadata.json + index.ts + 单一 master .svelte + components/` schema
- Tool 只能通过 `$lib/tool-sdk/index.js`、`$lib/components/shell/index.js` 和 `$lib/components/ui/index.js` 访问 framework 能力
- Heavy tech stack 通过共享 runtime 声明并加载（`three`、`pixi`、`gsap`）

