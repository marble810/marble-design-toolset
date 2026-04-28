## Why

`defaultPickFiles` 存在竞态条件：在 macOS 上，系统文件选择器关闭时 `focus` 事件先于 `input` 的 `change` 事件触发，导致 `setTimeout(0)` 回调在 `input.files` 还未填充时执行，Promise 以空数组 resolve，最终触发 "No file was provided for import." 错误，用户选择的文件被静默丢弃。

## What Changes

- 为 `defaultPickFiles` 引入 `resolved` 布尔旗帜，防止 `finish()` 被 `focus` 路径抢先调用
- 注册 `input` 的 `cancel` 事件监听（现代浏览器原生支持取消场景），消除取消检测对 `focus` + 定时器的依赖
- 将 `handleFocus` 的 `setTimeout(0)` 延迟增加至 `300ms`，作为旧浏览器（不支持 `cancel` 事件）的兜底
- 更新 `cleanup()` 同时移除新增的 `cancel` 监听

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `file-input-pipeline`：`defaultPickFiles` 的竞态修复属于内部实现变更，不改变 picker 的外部行为契约，但需要在对应 spec 中补充跨平台事件时序的保证性描述。

## Impact

- 受影响文件：`src/lib/runtime/file-input/controller.svelte.ts`
- 已有测试（`file-input.test.ts`）覆盖控制器核心逻辑，无需新增集成测试；但需要确认现有测试在修复后仍通过
- 无 API 变化，无破坏性改动
