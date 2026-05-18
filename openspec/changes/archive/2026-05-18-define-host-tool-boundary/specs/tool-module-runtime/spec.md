## ADDED Requirements

### Requirement: Tool runtime 依赖面限定在 public host boundary
Tool runtime SHALL 将 public host boundary 视为唯一受支持的宿主依赖面。Tool 可以依赖稳定 SDK、公开 capability 和 extension point；framework internal runtime 模块、controller 细节和私有 helper MUST NOT 被视为长期可依赖 contract。

#### Scenario: 新 tool 接入宿主 runtime
- **WHEN** 作者创建一个新 tool 并接入 runtime context、IO、export 或 lifecycle 能力
- **THEN** 该 tool 通过 public host boundary 完成接入，而不是直接导入 internal runtime 模块

#### Scenario: 旧 tool 继续依赖 internal 路径
- **WHEN** 一个现有 tool 仍使用历史 internal import 路径
- **THEN** framework 可以在兼容窗口内继续支持它，但该路径不会被文档和脚手架继续推荐

### Requirement: Tool contract validation 检查 host boundary 违规
仓库的 tool contract validation SHALL 能检测 tool 是否越过 public host boundary 直接依赖 internal framework 模块。发现违规时，validation MUST 报告对应 tool 与违规导入位置。

#### Scenario: Tool 导入 internal workspace controller
- **WHEN** 某个 tool 直接导入被标记为 internal 的 workspace controller 或 runtime helper
- **THEN** contract validation 失败并指出该 tool 存在 boundary 违规

#### Scenario: Tool 只依赖 public SDK
- **WHEN** 某个 tool 仅从 public SDK 和公开 capability 入口导入宿主能力
- **THEN** contract validation 不会因为 boundary 规则而报错
