## 1. 修复竞态条件

- [x] 1.1 在 `defaultPickFiles` 闭包内引入 `let resolved = false` 旗帜，并在 `finish()` 开头添加 `if (resolved) return; resolved = true;` 守卫，防止双重 resolve
- [x] 1.2 添加 `handleCancel` 函数，内容为调用 `finish()`；为 `input` 注册 `cancel` 事件监听：`input.addEventListener('cancel', handleCancel, { once: true })`
- [x] 1.3 将 `handleFocus` 中 `window.setTimeout` 的延迟从 `0` 改为 `300`，并将回调内容简化为直接调用 `finish()`（`isConnected` 检查由 `resolved` 旗帜取代，可移除）
- [x] 1.4 更新 `cleanup()` 函数，追加 `input.removeEventListener('cancel', handleCancel)` 以清理新增监听

## 2. 验证

- [x] 2.1 运行现有测试套件（`file-input.test.ts`），确认全部通过且无回归
- [x] 2.2 在浏览器中手动验证：打开 Chromatic Aberration 工具，点击 Browse 选择 PNG 文件，确认文件成功导入且不出现 "No file was provided for import." 错误
- [x] 2.3 手动验证取消场景：打开文件选择器后按 Esc 取消，确认 `lastError` 被设置为 `empty-selection`，`currentItem` 保持不变
