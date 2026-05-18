# tool-capability-recipes Specification

## Purpose
TBD - created by archiving change add-tool-capability-recipes. Update Purpose after archive.
## Requirements
### Requirement: 脚手架提供可选 capability recipes
Framework SHALL 为新 tool 提供一组可选 capability recipes，覆盖常见起步形态，如基础预览、带本地文件来源的预览、Pixi 预览、Three 舞台和带导出能力的预览工具。recipe MUST 作为作者体验层存在，而不是替代现有 tool schema。

#### Scenario: 作者创建带本地来源的预览工具
- **WHEN** 作者选择 source-preview recipe 创建新 tool
- **THEN** 生成代码包含 source workflow、DropZone 和 PreviewCanvas 的最小可运行 wiring

#### Scenario: 作者创建 Pixi 工具
- **WHEN** 作者选择 pixi-preview recipe
- **THEN** 生成代码包含 Pixi 推荐 wiring，并保持 tool schema 仍符合现有 runtime contract

### Requirement: Recipe 保持可跳出且不限制 tool 内部实现
Recipe SHALL 作为可选加速器存在。作者在使用 recipe 生成起步代码后，MAY 自由修改 tool 内部状态、组件结构和渲染逻辑；framework MUST NOT 将 recipe 输出本身视为后续演进的强约束。

#### Scenario: 作者偏离 recipe 继续开发
- **WHEN** 作者在生成 recipe 后重构 tool 的私有子组件或参数组织方式
- **THEN** 只要 tool 继续满足现有 schema 和宿主 contract，framework 仍视其为有效工具

#### Scenario: 作者不使用 recipe
- **WHEN** 作者选择手工搭建新 tool
- **THEN** 现有基础脚手架和 tool schema 仍然可用，recipe 不成为强制前置条件

