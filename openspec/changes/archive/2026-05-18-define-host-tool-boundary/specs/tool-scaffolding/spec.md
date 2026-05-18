## ADDED Requirements

### Requirement: 脚手架模板默认遵循 public host boundary
Tool 脚手架 SHALL 默认生成遵循 public host boundary 的模板。脚手架输出中的宿主能力导入 MUST 优先使用 public SDK、公开 capability 和推荐 extension point，而不是 internal runtime 模块路径。

#### Scenario: 作者生成新 tool starter
- **WHEN** 作者通过脚手架创建新的 tool
- **THEN** 模板中的 runtime、IO、export 和 lifecycle 相关导入默认指向 public host boundary

#### Scenario: Framework internal 结构演进
- **WHEN** framework internal runtime 模块发生重构但 public boundary 不变
- **THEN** 现有脚手架模板不需要因为 internal 路径变化而频繁改写

### Requirement: 脚手架为 boundary 规则提供最短上手路径
脚手架和作者文档 SHALL 把 public host boundary 作为作者接入 framework 的最短上手路径。脚手架 MUST NOT 通过示例代码鼓励作者直接依赖 internal 模块，即使这些 internal 模块在当前仓库内可见。

#### Scenario: 作者参考脚手架继续扩展功能
- **WHEN** 作者以脚手架输出为起点继续实现 tool
- **THEN** 其默认参考路径是 public boundary 和 capability，而不是 internal framework 结构

#### Scenario: 作者需要更深度的自定义
- **WHEN** 作者拥有超出默认模板的高级需求
- **THEN** 文档继续以 public boundary 为默认入口，只在明确说明为 internal / escape hatch 时才下探更深层实现
