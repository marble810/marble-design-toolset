# 工具开发者指南

## 适用对象

本节文档面向在 Deshelf 中开发 Visual Tool Project 的作者。Tool 是一个由 Deshelf Forge 在构建期编译、抽取并发布进 Catalog 的独立工程；运行时它只拥有 Canvas（与可选 Slate），Parameter Store、Standard Inspector 与 Session 生命周期全部由 Deshelf Host 拥有。

## 最短路径

```bash
# 1. 按照本节 create-a-tool.md 创建 Tool Project（tools/<slug>/）
# 2. 生成静态 Catalog 并启动 Web Host
bun run dev           # 等价于 bun run forge:web-catalog && vite dev
# 3. 打开根路由 /，从 Catalog 列表打开你的 Tool
```

## 心智模型

```text
tools/<slug>/
├─ manifest.json      ← 静态身份（唯一 Manifest）
├─ index.ts           ← Tool Entry（唯一登记点）
├─ canvas/            ← Main Container 的 Visual Tool Surface
├─ slate/             ← 可选 Tool Slate（独立 Container）
└─ sim/ 等            ← 私有组织文件（parameters.ts / assets… 仅供参考拆分）
```

- **Host 拥有**：Parameter Store（含 constraint 校验、computed 调度）、Standard Inspector（渲染 Catalog 里的 retained tree）、Session 生命周期、Asset 选择与 Export 编排。
- **Tool 拥有**：Canvas 像素、rAF 循环、GPU/simulation 状态、Tool Entry 的 callback 实现。这些热路径全部留在 Container 内，不经过 Environment API。

## 文档索引

| 文档 | 内容 |
|---|---|
| [create-a-tool.md](./create-a-tool.md) | 从零创建 Tool Project：manifest、Tool Entry、Parameter/Inspector/Asset/Output 与构建验证 |
| [export.md](./export.md) | Visual Output 声明、确定性导出回调与 Host 侧下载流程 |

## 核心约束

- 唯一登记点是根 `manifest.json` 与根 `index.ts`；`index.ts` 只有一份 `export default defineVisualTool(...)` 且顶层无副作用。
- Manifest 只写静态身份、`contractVersion`、`forgeProfile` 与 `libraries`；不写 entry、Parameter、Command、Inspector、Slate 或 Export。
- Parameter、computed、Constraint 通过 Tool Entry 的 `parameters` named map 声明；合法性权威在 Host Parameter Store。
- Inspector 是构建期抽取的 retained tree（`createInspector`），条件显示用 `visibleWhen`，不在运行时重建。
- 私有回调必须登记在 `privateCallbacks` named map（`defineInspectorCallback`），禁止 inline anonymous handler。
- Canvas/Slate 必须按需动态 import；禁止在 Canvas mount 后注册 exporter。
- Framework Libraries（`three`、`pixi`、`gsap`、`vgpu`）只由 Forge Profile 经 import map 供给；Tool 不自带 `node_modules` 或第三方 package。
- 样式使用 Svelte scoped CSS，单位用 px；Container realm 内没有 Host 的 `app.css`，引用共享 design token 时必须提供 fallback。

## 如何获取帮助

框架边界与 adapter 细节见 [framework developer 文档](../for-framework-developers/overview.md)；目标 architecture 见 [`../architecture/deshelf-architecture.md`](../architecture/deshelf-architecture.md)。
