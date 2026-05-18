## 1. 设计并建立新目录结构

- [x] 1.1 创建 `docs/for-framework-developers/`、`docs/for-tool-developers/` 与必要的子目录结构
- [x] 1.2 为两类读者各编写 overview 文档，说明适用对象、最短路径和相关文档索引

## 2. 迁移和拆分现有文档

- [x] 2.1 将 Making Tools、Styles、draft-plan 等现有文档移动或改写到新的角色目录中
- [x] 2.2 按角色拆分 public SDK、host-tool boundary、IO、export、Pixi/Three、recipes 等内容，避免 tool-facing 和 framework-facing 说明混在同一入口

## 3. 更新入口与 docs browser

- [x] 3.1 更新 README 和 docs 首页/导航说明，移除旧路径与已删除架构文档引用
- [x] 3.2 如有必要，调整 docs catalog 的排序或首页展示逻辑，使 framework/tool developer 两个入口清晰可见

## 4. 验证

- [x] 4.1 更新 docs catalog / route 测试，确认移动后的文档 slug、导航和 not found 行为稳定
- [x] 4.2 运行 docs 相关测试与构建，确认 mdsvex 文档浏览器和静态站点输出正常
