# Host-Tool Boundary

## 边界哲学

"框架开发不影响 tool，tool 开发不影响框架"的核心不是代码隔离，而是**边界稳定性**：tool 只依赖 public boundary，framework internal 不构成 tool contract。

Framework 演进（重构 runtime、拆分 shell、调整 lifecycle 实现）对 tool 透明，只要 public SDK surface 保持稳定。反之，tool 的内部组件设计、状态管理和渲染细节，framework 不应假设和依赖。

## Framework 职责

Framework **拥有**：
- Tool 发现、注册和懒加载
- Workspace shell 布局（ToolShell、workspace routing）
- Runtime 能力的实现（IO pipeline、export runtime、render host lifecycle）
- Public SDK 的维护和兼容性
- Host lifecycle 协调（session active、cleanup、exporter 注销）
- Contract validation（schema、import boundary）

Framework **不管**：
- Tool 内部状态结构
- Tool 内部组件拆分和私有 API
- Tool 使用的渲染抽象（Three.js scene graph、Pixi container 设计等）
- Tool 的样式架构

## Tool 职责

Tool **拥有**：
- `src/tools/<tool-id>/` 下的一切
- 内部状态模型
- 渲染逻辑和 shader/material 细节
- 私有子组件（`components/` 下）
- 参数化 UI 细节

Tool **不做**：
- 不直接依赖 `$lib/runtime/` 内部路径（除兼容窗口内显式保留的历史路径）
- 不重新实现 IO 管道（picker、drop、file reader、对象 URL 清理）
- 不实现下载按钮或文件导出 IO
- 不重写 host lifecycle（init、active、cleanup）

## Public/Internal 边界

**Public surface（tool 可依赖）：**

```
$lib/tool-sdk/index.js            ← 推荐入口，re-exports 全部 public capability
$lib/components/shell/index.js    ← 布局组件（LeftPanel、RightPanel、Section 等）
$lib/components/ui/index.js       ← Shared UI primitives（Button、SliderField 等）
```

**Internal（framework 可随时重构，tool 不直接依赖）：**

```
$lib/runtime/**/*                 ← 所有 runtime 实现细节
$lib/components/shell/tool-session/*   ← Session 内部组件
```

## Contract Validation

`scripts/tool-contract/validate.mjs` 自动验证：
- Tool 目录 schema（`metadata.json`、`index.ts`、单一 root-level `.svelte`）
- Tool 代码中是否存在 disallowed 的 `$lib/runtime/` 直接 import

在 build 前运行：

```bash
node scripts/tool-contract/validate.mjs
```

CI 在 `npm run build` 中自动执行 contract validation。

### 添加新的 disallowed 路径

如果某个 internal 模块被错误地当作 public API 使用，在 `validate.mjs` 的 `DISALLOWED_TOOL_IMPORTS` 中追加：

```js
const DISALLOWED_TOOL_IMPORTS = [
  '$lib/runtime/some-internal-module',
  // ...
];
```

### 兼容窗口

`ALLOWED_LEGACY_IMPORTS` 记录已知的历史兼容路径。新 tool 不应新增这类依赖；存量兼容路径应随后续 change 逐步收敛。

## 如何扩展 Public Surface

1. 先确认能力是否真的被 tool 需要（而不是内部 framework 辅助）。
2. 在 `src/lib/runtime/` 实现能力核心（保持 internal）。
3. 在 `src/lib/tool-sdk/index.ts` 添加 re-export 或 wrapper。
4. 更新 `docs/for-tool-developers/` 对应的使用文档。
5. 更新脚手架模板，让生成代码使用新 public API。
6. 运行 `npm run test` 确保 SDK re-export 测试通过。

**不要**把 internal registry、controller、内部事件总线等暴露到 public SDK——一旦暴露就变成需要维护的 contract。

## 兼容性与迁移策略

当 public SDK 中某个 API 需要修改：

1. 先保留旧导出，新导出使用新名称。
2. 在旧导出处添加 JSDoc `@deprecated` 注释，标注迁移目标。
3. 更新 `docs/for-tool-developers/` 中的文档，主推新 API。
4. 更新脚手架模板，新生成代码使用新 API。
5. 在后续 change 中评估是否移除旧导出（工程内所有 tool 迁移完成后）。

## Isolation Tiers（未来预留）

当前仓库内 trusted tool 使用 **Level 0**（API 隔离，无硬沙箱）：

| Level | 场景 | 隔离方式 |
|---|---|---|
| 0 | 仓库内 trusted tool（当前状态） | Public SDK + boundary validation |
| 1 | 可选受限 tool（未来） | Worker / iframe + capability allowlist |
| 2 | 不可信第三方 plugin（未来） | Sandbox + message bridge |

Level 1/2 为规范预留，当前不实现。
