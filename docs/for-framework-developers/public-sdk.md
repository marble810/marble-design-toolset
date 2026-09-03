# 维护 Tool SDK interface

> 本文描述 Deshelf Forge 目标 interface。SDK 不发布 npm；Desktop 通过 `.deshelf/` 为 Tool Project 提供类型，Forge Builder 使用相同 module aliases。

## 作者入口

Tool Project 只从 Forge-owned aliases import：

```ts
import {
  defineVisualTool,
  Label,
  Section,
  Slider,
  Toggle,
  Button
} from '@deshelf/tool-sdk';
```

Tool 不依赖仓库 `$lib/*`、Host internal modules、Workspace layout components 或 transport implementation。

## `defineVisualTool`

```ts
export default defineVisualTool({
  parameters: {},
  assets: {},
  commands: {},
  privateCallbacks: {
    resimulate: defineInspectorCallback({ run() {} })
  },
  outputs: {},
  createInspector({ root, parameters, assets, commands, privateCallbacks }) {},
  canvas: () => import('./canvas/Canvas.svelte'),
  slate: () => import('./slate/Slate.svelte'),
  dispose() {}
});
```

该 interface 同时服务两种 implementation：

- Forge extraction：生成 Catalog descriptors 与 artifacts；
- Main Container：保留 compute、Command、private callback 与 dispose functions。

不要再增加 `register()`/`unregister()` 或 runtime `tool.register`。

## SDK modules

目标 SDK 只暴露 Tool 作者必须学习的 modules：

```text
@deshelf/tool-sdk
├─ defineVisualTool
├─ parameter definitions
├─ Asset Slot definitions
├─ Tool Command/private callback definitions
├─ Visual Output definitions
├─ Inspector Element builders
├─ Environment client
└─ Tool Container lifecycle

@deshelf/three
@deshelf/pixi
@deshelf/gsap
@deshelf/vgpu
```

Framework Libraries 由 Forge Profile 固定版本并按 Tool Manifest 的 `libraries` 供给。

## Environment client

Environment client 隐藏 request/response 配对与 Web/Desktop transport 差异。Tool 面向领域 interface 操作：

```ts
context.parameters.get(id)
context.parameters.set(id, value)
context.assets.pick(options)
context.export.begin(options)
context.diagnostics.emit(diagnostic)
```

这些方法的 implementation 经 Environment API 工作。SDK 不暴露 MessagePort、postMessage、ipcRenderer、真实文件路径或 Host Svelte context。

## Inspector

Inspector SDK 创建 descriptor，而不是 DOM：

```ts
createInspector({ root, parameters, commands }) {
  const speed = new Slider({ label: 'Speed', step: 0.01 });
  speed.bind(parameters.speed);
  root.add(speed);
}
```

Forge 在构建期抽取 Inspector Tree，Host 在 Session 中渲染 Standard Controls。Tool Slate 是独立 DOM Surface，不是 Inspector Element。

Inspector private callback 必须先在 `privateCallbacks` named map 中登记；map key 是唯一稳定 ID。`createInspector` 只能绑定对应 typed handle，不能传入 inline anonymous callback。Asset Slot 与 Visual Output 同样通过 `assets`、`outputs` named maps 登记；Canvas 不在 mount 后注册 exporter。

## 添加新 SDK interface

只有当多个 Visual Tools 需要跨同一 seam 获得明显 leverage 时才扩展 SDK：

1. 先确认能力应由 Host、Forge 还是 Tool Container 拥有。
2. 将复杂 implementation 留在内部 module。
3. 设计最小 interface，并通过 Web/Desktop 两个 adapters 或 test doubles 验证 seam 真实存在。
4. 在 `tool-contract` 增加类型与 schema；在 `.deshelf/` 输出对应 declarations。
5. 增加 extraction/runtime conformance tests。
6. 更新 Tool author 文档与 Shallow Water 样本。

不要把 Catalog internals、Session coordinator、Workspace components、Builder internals 或 transport adapters暴露给 Tool。

## 迁移原则

迁移前 `src/lib/tool-sdk/index.ts` 中的同 realm contexts、layout exports、runtime exporter registration 与 `$lib` aliases 是旧 implementation。新 SDK 应替换这些 interfaces，而不是在旧 interface 上叠加 Environment API wrappers。
