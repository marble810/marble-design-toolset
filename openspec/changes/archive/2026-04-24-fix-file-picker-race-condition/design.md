## Context

`defaultPickFiles`（位于 `src/lib/runtime/file-input/controller.svelte.ts`）是 file-input 管道的 picker 默认实现。它通过动态创建一个隐藏 `<input type="file">` 元素并触发 `click()` 来打开系统文件选择器。选择完成后，通过监听两个事件来结束 Promise：

- `change`：用户选择了文件（正常路径）
- `window focus`：检测取消（用户关闭选择器但未选文件）

当前实现用 `input.isConnected` 作为"是否已完成"的守卫：如果 `change` 先触发，`finish()` 会移除 input 元素（`input.isConnected → false`），此时 `focus` 路径的 `setTimeout(0)` 回调检查到 `!isConnected` 后 noop。

**问题根源**：在 macOS 上（Chromium/Safari 均有此行为），事件顺序是：

```
1. 系统文件选择器关闭
2. 浏览器窗口重获焦点 → focus 事件触发
3. handleFocus → setTimeout(0) 入队（新 macrotask）
4. setTimeout(0) 回调执行：
   - input.isConnected = true（cleanup 未执行）
   - input.files = []（change 事件尚未触发）
   - finish() 以空数组 resolve → BUG
5. change 事件触发 → handleChange → 但 listener 已被 cleanup 移除
```

`setTimeout(0)` 本意是给 `change` 事件"让位"，但在 macOS 上这个假设不成立。

## Goals / Non-Goals

**Goals:**
- 消除 `defaultPickFiles` 中 `focus` 抢先于 `change` 导致的竞态
- 当用户选择了文件时，Promise 始终 resolve 含文件的数组
- 保留取消检测能力（用户未选文件时，Promise 以空数组 resolve）
- 利用现代浏览器原生 `cancel` 事件，减少对定时器启发式方案的依赖

**Non-Goals:**
- 修改控制器对外 API（`pick()`、`ingestFiles()`、错误类型均不变）
- 更改 drop 路径的行为（`extractDroppedFiles` 不涉及此竞态）
- 支持多文件选择

## Decisions

### 决策 1：引入 `resolved` 布尔旗帜替代 `isConnected` 守卫

**选择**：在 `defaultPickFiles` 闭包内维护 `let resolved = false`，`finish()` 开头加 `if (resolved) return; resolved = true;`。

**理由**：`isConnected` 反映的是 DOM 状态（input 是否在文档中），而不是"promise 是否已 resolve"这一语义。两者通过 `cleanup()` 耦合，当事件顺序改变时就产生了漏洞。`resolved` 旗帜直接表达意图，是最小且最准确的守卫。

**考虑的替代方案**：
- 继续用 `isConnected`，只增大 setTimeout 延迟 → 仍是启发式，无法保证
- 改用 `AbortController` → 过度复杂，不值得

### 决策 2：注册 `cancel` 事件监听处理取消场景

**选择**：为 `input` 元素注册 `{ once: true }` 的 `cancel` 事件：

```
input.addEventListener('cancel', handleCancel, { once: true });
```

`handleCancel` 调用 `finish()`，此时 `input.files` 为空，resolve `[]`。

**理由**：现代浏览器（Chrome 113+、Safari 16.4+、Firefox 91+）为 `<input type="file">` 原生支持 `cancel` 事件，语义精确。有了 `cancel` 监听，`focus` + 定时器方案降级为旧浏览器兜底，不再是主路径。

**考虑的替代方案**：
- 完全废弃 focus+timeout 路径 → 旧浏览器取消后 Promise 永不 resolve，用户无法再次点击

### 决策 3：`handleFocus` 的 setTimeout 延迟从 0 增至 300ms

**选择**：`window.setTimeout(() => { finish(); }, 300)`。

**理由**：仅当旧浏览器（无 `cancel` 事件支持）使用此路径。300ms 能让 `change` 事件在绝大多数平台/机器上先于定时器回调触发。配合 `resolved` 旗帜，即使 `change` 先触发，`finish()` 已被标记 resolved，定时器回调 noop。

### 决策 4：`cleanup()` 同时移除 `cancel` 监听

`cleanup()` 需追加 `input.removeEventListener('cancel', handleCancel)`，避免在 `finish()` 后的多余触发（虽然 `resolved` 旗帜会拦截，但明确清理更健壮）。

## Risks / Trade-offs

- **[风险] 300ms 在极端慢设备上仍不足** → 有 `resolved` 旗帜兜底：即使 300ms 内 `change` 未触发，之后的 `change` 也只会因 `resolved=true` 而 noop，而不是二次 resolve；用户只需重新选择文件。接受。
- **[风险] `cancel` 事件在 Electron 等非标准环境中行为未知** → `focus` + timeout 作为兜底，`resolved` 旗帜防止重复 resolve，两路径共同保障。接受。
- **[取舍] 300ms 延迟在旧浏览器取消场景中引入轻微 UI 延迟** → 取消场景本身是异常路径，300ms 感知不明显。可接受。
