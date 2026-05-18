## 1. 设计 recipe 输入与输出 contract

- [x] 1.1 确定首批 capability recipes 的列表、适用场景和输入参数映射
- [x] 1.2 为每个 recipe 定义模板输出 contract，明确需要复用的 shared runtime、shared UI 和 public SDK 入口

## 2. 扩展脚手架实现

- [x] 2.1 扩展 `create:tool` 交互流程，支持作者按 recipe 选择起步形态
- [x] 2.2 为 preview-basic、source-preview、pixi-preview、three-stage 和 preview-export 补齐模板与生成逻辑

## 3. 文档与验证

- [x] 3.1 更新 README 与 Making Tools 文档，围绕 recipe 重写最短上手路径
- [x] 3.2 为脚手架模板和 contract validator 补充测试，并运行构建确认 recipe 产物符合现有 tool schema
