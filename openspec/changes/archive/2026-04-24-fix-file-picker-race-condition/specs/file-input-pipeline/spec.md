## ADDED Requirements

### Requirement: File picker resolves correctly regardless of OS-level focus/change event order
Framework 的默认 picker 实现 MUST 保证：无论操作系统在文件选择器关闭时以何种顺序触发 `focus` 与 `change` 事件，只要用户选择了文件，picker Promise SHALL 以包含该文件的数组 resolve，而不会以空数组 resolve。框架 MUST 使用显式的 resolved 状态旗帜防止 finish 逻辑被重复触发或在文件填充前提前触发。

#### Scenario: User selects a PNG file in the OS file picker on macOS
- **WHEN** 用户在 macOS 上点击 Browse 按钮并在文件选择器中选择一个 PNG 文件
- **THEN** controller 的 `currentItem` 被更新为该 PNG 文件对应的 `ImportedImageFileItem`，`lastError` 为 null

#### Scenario: Focus event fires before change event
- **WHEN** 浏览器先触发 `window focus` 事件、再触发 `input change` 事件（如 macOS 上的典型顺序）
- **THEN** picker 的 resolved 旗帜确保 `finish()` 不会在 `input.files` 填充之前 resolve，最终结果与 change-first 顺序完全相同

#### Scenario: User cancels the file picker without selecting a file
- **WHEN** 用户打开文件选择器后点击取消（或按 Esc 关闭）
- **THEN** picker Promise 以空数组 resolve，controller 的 `lastError` 被设置为 `empty-selection`，`currentItem` 保持不变
