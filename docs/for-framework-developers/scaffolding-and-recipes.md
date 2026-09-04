# Tool Project 脚手架与 Forge 流水线

> 迁移期说明：旧的 `scripts/create-tool.js`、`scripts/tool-scaffold/`（生成 Tool-owned panels/runtime contexts 的 recipe 模板）与 `scripts/tool-contract/validate.mjs`（regex 校验 `metadata.json` 与 master Svelte）已随旧 runtime 删除。新脚手架事实标准是共享 `tool-builder` 流水线与参考 Tool Project。

## 参考实现

| 工程 | 角色 |
|---|---|
| `tools/hello-canvas/` | 最小可运行样例：Parameter、computed、Command、private callback、Canvas + Slate、一个 image output |
| `tools/shallow-water/` | 完整迁移样本：GPU simulation 热路径、Asset Slot、Inspector `visibleWhen`、确定性 PNG/视频 Visual Output |
| `packages/tool-builder/fixtures/projects/` | 流水线 fixture（valid / with-slate / throwing / hanging），支撑 extraction 与 catalog 测试 |

新 Tool Project 的创建方式是**复制参考实现并裁剪**，然后按 [Tool developer 指南](../for-tool-developers/create-a-tool.md) 逐项核对登记点。不再存在生成 `metadata.json` + master Svelte 的脚手架 CLI。

## 共享构建流水线

所有 Tool 构建（Web 静态 Catalog 与 Desktop Open Project）都走 `packages/tool-builder` 的 `buildToolProject`：

```text
读 manifest.json → 编译 index.ts + Canvas/Slate（Vite + Svelte，声明库 external）
  → 受控 extraction worker（terminable + timeout）求值 Tool Entry
  → 执行 descriptor-only createInspector → 校验 named-map bindings
  → 生成 Catalog Entry（确定性、无时间戳）→ upsert CatalogStore
```

维护要点：

- 编译 externals 由 `isFrameworkLibraryImport`（`pipeline.ts`）决定：`svelte*` 恒外置，`manifest.libraries` 声明的库（含子路径）外置，其余 bare import 打进 artifact。
- Extraction worker 在独立进程加载**编译产物**，绝不执行 Canvas/GPU；inline anonymous private callback 与非法 binding 在这里失败。
- `.deshelf/` IDE 声明与 schema 是 Desktop 构建成功后的唯一写回（`apps/desktop/src/main/declarations.ts`）。
- 新增 contract 字段（例如 Inspector `visibleWhen`）时，同步更新：`tool-contract` 校验、`tool-sdk` builder、`tool-host` InspectorHost 视图模型、Web `ForgeInspector` 与 Desktop `inspector-dom` 两个渲染端，以及 fixtures 测试。
