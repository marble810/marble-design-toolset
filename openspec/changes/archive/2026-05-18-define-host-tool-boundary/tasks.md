## 1. 建立 Host–Tool Boundary Charter

- [x] 1.1 定义 host owns / tool owns、public API / internal API、capability / extension point 与 isolation tiers 的总规范
- [x] 1.2 将总规范同步到相关 capability delta specs，明确它与现有 runtime、shell 和脚手架 contract 的关系

## 2. 落实 boundary enforcement

- [x] 2.1 扩展 tool contract validation，使其能够检测 tool 对 internal framework 模块的违规依赖
- [x] 2.2 更新脚手架模板和作者示例，使其默认只通过 public boundary 导入宿主能力

## 3. 文档与迁移策略

- [x] 3.1 更新作者文档，明确 public boundary、internal 模块和 escape hatch 的含义与使用边界
- [x] 3.2 为后续 public API 演进补充 deprecation / migration 约定，并说明 isolation tiers 的未来演进路径
