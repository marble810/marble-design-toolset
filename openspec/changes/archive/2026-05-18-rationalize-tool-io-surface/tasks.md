## 1. 收口 IO 分层职责

- [x] 1.1 明确 `runtime/file-input`、`runtime/io` 和 `components/tool-io` 的职责边界与默认推荐入口
- [x] 1.2 调整 tool-facing IO 导出结构，使作者能够从一致的 public surface 进入 source workflow 和共享 UI

## 2. 更新作者入口

- [x] 2.1 更新脚手架和示例模板，使带本地文件来源的 tool 默认从 tool IO facade 起步（本分支按文件 ownership 不改脚手架 recipe 模板；已通过 SDK re-export 与指南示例收口默认入口）
- [x] 2.2 更新文件输入与 tool authoring 文档，明确默认路径与底层 escape hatch 的关系

## 3. 验证兼容与迁移

- [x] 3.1 补充测试，确认高层 facade 复用底层 file-input pipeline 时不会改变现有读取、错误和清理语义
- [x] 3.2 运行相关测试与构建，确认现有直接使用 `file-input` 的 tool 仍然兼容
