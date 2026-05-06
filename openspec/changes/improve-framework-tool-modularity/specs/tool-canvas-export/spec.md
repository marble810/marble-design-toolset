## ADDED Requirements

### Requirement: Export Section 支持多个 exporter 的选择
当同一 tool 注册多个 exporter 时，framework SHALL 在 Export Section 中提供 exporter 选择控件。每个 exporter MUST 具有稳定 id 和可显示 label；若 tool 只注册一个 exporter，framework SHALL 保持现有单 exporter UI，不额外显示选择控件。

#### Scenario: Tool 注册多个 exporter
- **WHEN** 当前 tool 的 export context 中存在两个或更多 registered exporters
- **THEN** Export Section 显示 exporter 选择控件，并使用当前选中的 exporter 计算 capability 和执行导出

#### Scenario: Tool 只注册一个 exporter
- **WHEN** 当前 tool 的 export context 中只有一个 registered exporter
- **THEN** Export Section 不显示 exporter 选择控件，导出行为保持单 exporter 模式

#### Scenario: 当前 exporter 被注销
- **WHEN** 当前选中的 exporter 被注销
- **THEN** Export Section 自动选择仍然存在的下一个 exporter；若不存在 exporter，则禁用导出控件并显示提示

### Requirement: Export 默认文件名使用 runtime toolId
Export Section SHALL 使用 tool runtime context 中的真实 `toolId` 生成默认文件名，格式仍为 `<tool-id>-<yyyymmdd-hhmmss>.<ext>`。Framework MUST NOT 从 metadata name slugify 得到默认文件名前缀。

#### Scenario: Tool name 与 tool-id 不完全一致
- **WHEN** tool-id 为 `noise-texture-creater` 且 metadata name 为 `Noise Texture Creater`
- **THEN** 默认导出文件名前缀为 `noise-texture-creater`，而不是通过 name 重新 slugify 的其他值

#### Scenario: 用户覆写文件名
- **WHEN** 用户在 Export Section 中输入自定义文件名
- **THEN** framework 使用用户输入作为 basename，并继续由 framework 决定扩展名

### Requirement: Export Section 显示声明与注册能力 mismatch 诊断
当 metadata export 声明与 active exporter 的 resolved capabilities 不匹配时，framework SHALL 在 Export Section 中显示稳定诊断，并禁用不满足运行时能力的操作。诊断 MUST 区分“未注册 exporter”、“声明 image 但 exporter 不支持 PNG”、“声明 video 但 exporter 或浏览器不支持视频导出”。

#### Scenario: Tool 声明 image 但 exporter 不支持 PNG
- **WHEN** metadata.export.image 为 true，但 active exporter 的 resolved png 为 false
- **THEN** Export Section 禁用图片导出并显示 PNG capability mismatch 诊断

#### Scenario: Tool 声明 video 但浏览器不支持录制
- **WHEN** metadata.export.video 为 true，但当前浏览器没有可用 MediaRecorder mime
- **THEN** Export Section 禁用视频导出并说明当前浏览器不支持视频导出

#### Scenario: Tool 声明 export 但未注册 exporter
- **WHEN** metadata export 至少一个标志为 true，且当前 exporter 列表为空
- **THEN** Export Section 禁用所有导出控件并显示未注册 exporter 诊断

### Requirement: Export task 状态在 Section 内保持一致
Framework SHALL 在 Export Section 内统一管理导出任务状态。导出进行中时，相关控件 MUST disabled；任务完成后 MUST 在 Section 内显示成功、失败或降级格式结果；新任务开始时 MUST 清理上一任务的结果。

#### Scenario: 用户启动图片导出
- **WHEN** 用户点击 Export Image
- **THEN** Export Section 进入 busy 状态并禁用相关控件，直到导出成功或失败

#### Scenario: 导出失败
- **WHEN** PNG 或视频导出流程抛出错误
- **THEN** Export Section 退出 busy 状态，并在 Section 内显示错误消息

#### Scenario: 用户启动新导出任务
- **WHEN** 上一次导出结果仍显示时用户启动新的导出任务
- **THEN** Export Section 清理旧结果并显示当前任务状态