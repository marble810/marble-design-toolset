## ADDED Requirements

### Requirement: File input pipeline 作为底层 primitive 保持稳定
Unified file input pipeline SHALL 继续作为底层 primitive 保持稳定，可被更高层的 tool-facing IO facade 复用，但其现有读取、校验、错误语义和资源清理行为 MUST 保持不变。Framework MUST NOT 因为新增默认推荐入口而移除 tool 直接使用底层 pipeline 的能力。

#### Scenario: Tool 直接使用底层 pipeline
- **WHEN** 一个 tool 有特殊需求并直接导入 file input pipeline
- **THEN** 该 tool 继续可以实例化底层控制器并获得现有标准化读取与错误语义

#### Scenario: 高层 facade 复用底层 pipeline
- **WHEN** 更高层的 tool IO facade 包装 file input pipeline
- **THEN** picker、drop、校验、读取和 object URL 清理行为仍由底层 pipeline 负责
