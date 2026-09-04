# 创建 Tool Project

> 本文是 Catalog-driven architecture 下的 Tool 作者指南。迁移期的 `metadata.json`、master Svelte、`tool-registry.ts` 与 Tool-owned panels 已删除，不再存在第二条路径。完整参考实现见 `tools/hello-canvas/`（最小样例）与 `tools/shallow-water/`（GPU 模拟 + Asset + Export 样例）。

## 目录

1. [目录结构](#目录结构)
2. [manifest.json](#manifestjson)
3. [Tool Entry（index.ts）](#tool-entryindexts)
4. [Parameter 定义](#parameter-定义)
5. [Inspector Tree](#inspector-tree)
6. [Asset Input](#asset-input)
7. [Visual Output](#visual-output)
8. [Canvas 与 Slate](#canvas-与-slate)
9. [Framework Libraries](#framework-libraries)
10. [Container 内共享状态](#container-内共享状态)
11. [构建与验证](#构建与验证)
12. [规则清单](#规则清单)

## 目录结构

```text
tools/<slug>/
├─ manifest.json          # 根目录唯一 Tool Manifest
├─ index.ts               # 固定 Tool Entry，唯一 export default defineVisualTool
├─ tsconfig.json          # 仅服务 IDE；不进入构建
├─ .gitignore             # 至少忽略 .deshelf/
├─ canvas/Canvas.svelte   # Main Container 的 Visual Tool Surface
├─ slate/Slate.svelte     # 可选：第二 Container（独立 realm）
├─ parameters.ts          # 可选拆分：Parameter 定义
├─ inspector.ts           # 可选拆分：createInspector
├─ outputs.ts             # 可选拆分：Visual Output 定义
├─ sim/                   # 可选拆分：simulation / 渲染热路径
└─ .deshelf/              # 生成物（Desktop 构建成功后写入；gitignore）
```

`parameters.ts`、`inspector.ts`、`outputs.ts`、`sim/` 只是私有组织；唯一登记点仍是根 `index.ts`。不得出现第二个注册入口，也不得自带 `node_modules`、第三方 package 或 Vite/Svelte 配置。

## manifest.json

```json
{
  "contractVersion": 1,
  "projectId": "8f2c1a0e-1111-4222-8333-444455556666",
  "slug": "shallow-water",
  "name": "Shallow Water Height",
  "description": "Generate black-and-white shallow water height animations.",
  "tags": ["simulation", "height-map"],
  "version": "1.0.0",
  "forgeProfile": "forge-v1",
  "libraries": ["three"]
}
```

- `projectId` 是不可变逻辑身份（UUID，一次生成永不复用）；复制文件夹不会改变身份，同一 Project ID 出现在多个 Location 时由 Host 用 `catalogEntryId` 区分。
- `slug` 是 kebab-case 且全局唯一；`version` 必须是 semver。
- Manifest 是**封闭 schema**：只允许上述静态身份字段。entry、Parameter、Command、Inspector、Capability、Slate、Export、`enabled` 都不允许出现。

## Tool Entry（index.ts）

```ts
import { defineInspectorCallback, defineVisualTool } from '@deshelf/tool-sdk';

export default defineVisualTool({
  parameters: { /* named map */ },
  assets: { /* typed Asset Slots */ },
  commands: { /* 公开 Tool Command */ },
  privateCallbacks: {
    resimulate: defineInspectorCallback({ run() { /* Main-only 回调 */ } })
  },
  outputs: { /* Visual Output */ },
  createInspector({ root, parameters, commands, privateCallbacks }) {
    /* 构建 retained Inspector Tree */
  },
  canvas: () => import('./canvas/Canvas.svelte'),
  slate: () => import('./slate/Slate.svelte'),   // 可选
  dispose() { /* Container 关闭时清理模块级状态 */ }
});
```

硬性规则：

- `index.ts` 顶层**无副作用**：不执行 IO、不创建 GPU 资源、不注册任何东西。
- Canvas 与 Slate 必须**动态 import**；entry 本体保持轻量，让 Forge 的 extraction worker 能在不加载 Three/Pixi 的情况下求值。
- `privateCallbacks` 的 map key 就是稳定 callback ID；`run` 实现留在 Main artifact，Catalog 只保存 `{ kind, callbackId }`。

## Parameter 定义

Parameter 是**扁平 set**，全部声明在 `parameters` named map 中；Host Parameter Store 是合法性的唯一权威。

```ts
import type { ParameterDefinition } from '@deshelf/tool-sdk';

export const PARAMETER_DEFINITIONS: Record<string, ParameterDefinition> = {
  resolution: {
    type: 'select',
    label: 'Resolution',
    default: '256',
    mode: 'manual',
    constraint: { type: 'select', options: ['128', '256', '512'] }
  },
  amplitude: {
    type: 'number',
    label: 'Amplitude',
    default: 0.45,
    mode: 'manual',
    constraint: { type: 'number', min: 0, max: 2, step: 0.01 }
  }
};
```

- `type`：`number | boolean | string | select`；`constraint` 必须与 type 匹配。
- `mode`：`manual`（默认）、`overrideable`、`computed`。`computed` 必须提供 `compute`（纯函数、无 GPU/IO，由 Host 调度、Main 执行）并声明 `dependsOn`。
- 超出 constraint 的写入会被 Store **拒绝**（而不是 clamp）；Canvas 读取 snapshot 后自行做数值视图转换（如 select 字符串 → number）。
- 不要为了"凑 computed coverage"添加没有产品意义的派生参数。

## Inspector Tree

`createInspector` 在 **Forge 构建期**对 descriptor-only SDK 执行一次，产出的 retained tree 进入 Catalog；Session 中由 Host 直接渲染，Tool 不再持有任何控件组件。

```ts
import type { InspectorContext } from '@deshelf/tool-sdk';

export function buildInspector({ root, parameters, privateCallbacks }: InspectorContext): void {
  root.section('simulation', 'Simulation', (section) => {
    section.slider({ id: 'amplitude', label: 'Amplitude', bind: parameters.amplitude });
    section.button({ id: 'resimulate', label: 'Resimulate', bind: privateCallbacks.resimulate });
  });
}
```

- Binding 只接受 typed handle（`parameters.<id>` / `commands.<id>` / `privateCallbacks.<id>`）；inline anonymous callback 在 extraction 阶段直接失败。
- 条件显示用 `visibleWhen`（Host 按 live Store 值求值，支持 `equals: value | value[]`），配合 section 嵌套表达组合条件；不要在运行时重建 tree。
- 没有 `createInspector` 时，Host 按 Parameter descriptors 生成默认 tree。

## Asset Input

Asset Slot 声明在 `assets` named map；Host 拥有文件选择与内容生命周期，Container 通过 Environment client 拿到可读 URL。

```ts
assets: {
  initMap: { kind: 'image', label: 'Init Map', accept: ['image/*'], required: false }
}
```

Container 侧读取（Web 交付 blob URL；Desktop 交付 `deshelf-cache://` opaque URL——真实文件路径永不进入 Tool）：

```ts
const content = context.assets.values().initMap;
if (content?.kind === 'blob-url') {
  // content.url 可直接交给 <img>/fetch/Image
}
```

- 订阅 `context.assets.subscribe(...)` 获得变更；`asset.request`/`requestAsset(id)` 拉取当前内容。
- Web 上 Tool 也可以通过 `context.setParameter(...)` 回写 Parameter（例如"选了图自动切到 image 模式"）——它仍然经过 Host Store 校验与广播。

## Visual Output

见 [export.md](./export.md)。要点：`outputs` named map 声明 descriptor（进 Catalog），`render` 回调留在 Main artifact 并在 Container 内执行；禁止 Canvas mount 后 runtime 注册 exporter。

## Canvas 与 Slate

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import type { ContainerSurfaceContext } from 'tool-sdk';

  let { context }: { context: ContainerSurfaceContext } = $props();

  onMount(() => {
    // rAF、GPU context、simulation state 全部留在这里
    return () => { /* dispose */ };
  });
</script>
```

- `context` 提供：`sessionId`、`surface()`/`onSurface`、`parameters` mirror、`assets` mirror、`setParameter`、`requestAsset`、`reportDiagnostic`。
- Surface 尺寸由 Host 发送 `surface.resize`；Canvas 元素的 CSS 自适应容器，backing store 尺寸由 Tool 决定。
- Slate 与 Main 不共享 JavaScript realm：跨 Surface 协作只能通过 Host Parameter Store 与 Tool Command。
- Tool Slate 失败不阻塞 Canvas Ready，但会产生 Surface diagnostic。

### 样式

- 只用 Svelte scoped CSS；单位一律 px。
- Container realm **没有** Host 的 `app.css`：使用 `var(--token, fallback)` 形式给共享 token 提供 fallback，或直接写 px 值。
- Svelte 编译只接受 TS 语法子集（类型标注）；不要在 `<script lang="ts">` 里用需要预处理的特性。

## Framework Libraries

`manifest.libraries` 只能声明 `three | pixi | gsap | vgpu`。声明后：

```ts
import * as THREE from 'three';   // bare import 保留为 external
```

Forge 会把库编译为 import map 供给（Web 与 Desktop 同一套机制），多个 Tool 共享同一 runtime 实例。Tool **永不自带**库的拷贝。

## Container 内共享状态

Canvas、private callback、Command 与 Output 回调运行在同一个 Container realm，但不在同一个组件作用域。推荐模式（shallow-water 即如此）：

1. `createRuntime(context)` 工厂集中每 Session 的 state 与 dispose，由 Canvas mount/unmount 驱动；
2. 一个 realm 级 holder 把 runtime 暴露给 entry 侧回调（`outputs.render`、`privateCallbacks.run`）。Realm 每次 Reload/Restart 都会重建，因此天然按 Session 隔离，不构成全局注册。
3. 未挂载时回调必须显式失败（如 `throw new Error('simulation canvas is not mounted')`），不要静默返回空结果。

## 构建与验证

```bash
bun run forge:web-catalog   # 扫描 tools/ → 构建 → 生成 static/deshelf/catalog.json
bun run dev                 # 开发服务器（自动生成 Catalog）
bun test                    # 全量测试（packages + tools + forge + desktop）
bun run typecheck           # packages + apps/desktop
bun run build               # 生产构建（含 Catalog 生成）
bun run smoke:web-adapter   # 真实浏览器冒烟（需要本机 Chrome/Edge）
```

- 构建失败的 Tool Project **不会进入可用 Catalog**，只以 failures + diagnostics 上报；先修 diagnostics 再迭代。
- Desktop 验证：`bun run dev:desktop` → Open Project 选择 Tool Project 目录；构建成功后会写回 `.deshelf/` IDE 声明（这是对工程唯一的写回）。
- 失败诊断代码常见于 `manifest/*`、`extract/*`、`inspector/*`、`build/*`，信息里带 path。

## 规则清单

- [ ] 根目录只有 `manifest.json` + `index.ts` 两个登记点。
- [ ] `index.ts` 顶层无副作用，Canvas/Slate 动态 import。
- [ ] 私有回调全部走 `privateCallbacks` named map，无 inline anonymous handler。
- [ ] Parameter constraint 完整；computed 有 `compute` + `dependsOn`。
- [ ] Inspector 用 typed handle 绑定；条件显示用 `visibleWhen`。
- [ ] 声明的 `libraries` 与实际 bare import 一致。
- [ ] `dispose()` 清理模块级状态；Canvas 卸载释放 GPU/URL 资源。
- [ ] `bun run forge:web-catalog` 通过且 entry 出现在 Catalog。
