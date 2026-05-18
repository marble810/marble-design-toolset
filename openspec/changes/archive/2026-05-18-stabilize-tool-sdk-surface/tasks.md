## 1. 定义稳定 SDK 边界

- [x] 1.1 盘点现有 tool 会直接依赖的 runtime/types/helper 入口，并划分 public SDK 与 internal 模块边界
- [x] 1.2 设计并落地 repo-local tool SDK 入口与 re-export 结构，覆盖 ToolDefinition、runtime context、source input、export 和 render host 的推荐入口

## 2. 迁移脚手架与文档

- [x] 2.1 更新脚手架模板，使新生成 tool 默认从稳定 SDK 入口导入宿主能力
- [x] 2.2 更新 Making Tools 相关文档，明确 public SDK、internal 模块与迁移策略

## 3. 兼容与验证

- [x] 3.1 为旧导入路径保留兼容窗口，并补充测试覆盖 public SDK 与旧工具兼容行为
- [x] 3.2 运行相关测试与构建，确认 SDK 收口未破坏现有 tool 加载、导出和 runtime context 行为
