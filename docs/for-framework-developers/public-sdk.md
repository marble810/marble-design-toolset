# 维护 Public SDK

## SDK 入口

Public SDK 统一从 `src/lib/tool-sdk/index.ts` re-export。所有 tool 通过 `$lib/tool-sdk/index.js` 访问 framework 能力，不直接依赖 `$lib/runtime/` 内部路径。

## 当前 Public Exports

### Tool 定义与元数据

```ts
export type {
  ToolDefinition,       // tool index.ts 中的 definition 类型
  ToolMetadata,         // metadata.json schema 类型
  ToolMenuAction,
  ToolExportDescriptor,
  ToolExportCapabilities,
  // ...
}
```

### Tech Stack 加载

```ts
export { loadTechStack, loadTechStacks }
export type { TechStackType, TechStackMap }
```

### Runtime Context

```ts
export { getToolRuntimeContext }   // tool 读取自身 metadata、id、路由参数
export { getToolSessionContext }   // 读取 active 状态、session info
```

### IO（文件输入）

```ts
export { createToolSourceInput }   // Source workflow facade（推荐入口）
export { DropZone, SourceInputSection }  // 共享 UI 组件
export { createFileInputController, readFileInputItem, extractDroppedFiles }  // escape hatch
export { triggerDownload, summarizeFileInput }
export type { ToolSourceInput, ToolSourceInputOptions, ImportedFileItem }
```

### Canvas Export

```ts
export { getCanvasExportContext }
export type { CanvasExportContext, ExportFrameSource, /* ... */ }
```

### Render / Lifecycle

```ts
export { createToolHostLifecycle }          // 通用 host lifecycle（无 render host）
export { createRenderHostLifecycle }        // render host + lifecycle（推荐给 Pixi/Three）
export { createPixiApplicationHost }        // Pixi 预热应用实例
export { createThreeRenderHost }            // Three.js render host
export { createCanvas2DRenderHost }         // Canvas 2D render host
```

完整列表见 `src/lib/tool-sdk/index.ts`。

## 添加新 Public Export

**决策标准：**

| 情况 | 处理 |
|---|---|
| Tool 需要直接访问，且多个 tool 会用到 | 添加到 SDK |
| 只有一个 tool 在用，且没有明确复用价值 | 暂时不加 SDK；等有第二个用例再评估 |
| 纯 framework 内部辅助（registry、controller 等） | 不加 SDK |

**步骤：**

1. 在 `src/lib/runtime/` 或 `src/lib/components/` 中实现或找到需要暴露的模块。
2. 在 `src/lib/tool-sdk/index.ts` 中添加 re-export：
   ```ts
   export { newHelper } from '$lib/runtime/some-capability/index.js';
   export type { NewHelperOptions } from '$lib/runtime/some-capability/types.js';
   ```
3. 在 `docs/for-tool-developers/` 的对应指南中补充用法说明。
4. 如果影响脚手架，更新 `scripts/tool-scaffold/templates/index.js` 使模板使用新 API。
5. 补充 test coverage（`src/lib/runtime/<capability>/<capability>.test.ts`）。
6. 运行 `npm run test` 和 `npm run build` 验证。

## Deprecation 流程

当需要修改或移除已有 public export：

```ts
// src/lib/tool-sdk/index.ts

/** @deprecated 请改用 `createToolSourceInput`，将在后续版本移除。 */
export { legacySourceHelper } from '$lib/runtime/file-input/legacy.js';

// 新 API
export { createToolSourceInput } from '$lib/runtime/io/index.js';
```

同步更新：
1. `docs/for-tool-developers/` 中的对应文档（主推新 API）
2. 脚手架模板使用新 API
3. 有条件时把仓库内 tool 迁移到新 API（完成后再移除旧 export）

## 版本治理

当前仓库采用单仓库模式，不独立发布 SDK npm 包，因此不需要 semver 版本号。兼容性通过以下方式保证：

- Public SDK 路径变化必须经过 deprecation 周期，不能直接删除
- Internal 路径随时可以重构，不受此约束
- Contract validation 自动阻止 tool 引用 internal 路径

若未来演进为独立分发插件平台，需要在此基础上引入 semver 和 API compatibility test。
