## ADDED Requirements

### Requirement: 脚手架模板使用共享 workflow UI
Tool 脚手架 SHALL 在生成 preview 或 stage starter 时优先使用共享 workflow UI 组件组织常见字段、模式切换、预设和文件来源示例。脚手架 MUST NOT 复制已有共享组件可以覆盖的 field、preset、source input 或 drop zone 交互逻辑。

#### Scenario: 开发者生成 preview starter
- **WHEN** 开发者通过脚手架创建 preview starter
- **THEN** 生成的 master 组件继续使用 LeftPanel、RightPanel 和 PreviewCanvas，并在需要示范控件时使用共享 field UI

#### Scenario: 开发者生成文件输入示例 starter
- **WHEN** 脚手架提供或扩展到文件输入 starter
- **THEN** 生成代码使用共享 SourceInputSection 和 DropZone，而不是手写 picker/drop/error UI

### Requirement: 脚手架模板使用 render host lifecycle helper
当脚手架生成声明 `three`、`pixi` 或 `gsap` 的 starter 时，输出代码 SHALL 展示共享 tech stack runtime 与 render host lifecycle helper 的推荐集成方式。模板 MUST 保持技术栈声明只写入 `index.ts` 的 runtime definition。

#### Scenario: 开发者选择 Pixi starter
- **WHEN** 开发者创建声明 `pixi` 的 starter
- **THEN** 生成的子组件使用 render host lifecycle helper 初始化和清理 Pixi host

#### Scenario: 开发者选择 Three starter
- **WHEN** 开发者创建声明 `three` 的 starter
- **THEN** 生成的子组件使用 render host lifecycle helper 初始化和清理 Three host

#### Scenario: 开发者未选择技术栈
- **WHEN** 开发者创建不声明重型技术栈的 starter
- **THEN** 生成代码不导入或加载 `three`、`pixi`、`gsap`

### Requirement: 脚手架与作者文档保持 framework-owned export 一致
脚手架输出和 Making Tools 文档 SHALL 避免示范 tool 自行实现 PNG/MP4 编码、`toDataURL()` 下载或 `a.click()` 下载。需要导出时，文档和模板 MUST 引导 tool 通过 metadata export 声明与 canvas export runtime 注册 exporter。

#### Scenario: 文档展示 Pixi 或 Three 导出
- **WHEN** 作者阅读 Pixi 或 Three tool 指南中的导出示例
- **THEN** 示例使用 framework-owned canvas export runtime，而不是在 tool 内创建下载链接

#### Scenario: 脚手架生成可导出 starter
- **WHEN** 脚手架未来生成带 export 能力的 starter
- **THEN** metadata 包含 export 声明，预览子组件注册 exporter，且不包含自定义下载实现