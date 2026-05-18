## 1. 定义统一 host lifecycle contract

- [x] 1.1 提炼 init、ready/error、active/inactive、cleanup 和 exporter registration 的统一宿主生命周期语义
- [x] 1.2 设计新的 lifecycle-aware helper API，并明确它与 render host、session context、canvas export 的边界

## 2. 对齐现有宿主能力

- [x] 2.1 调整 `tool-session-context` 与相关 helper，使 active/inactive 状态可被统一 host lifecycle 消费
- [x] 2.2 调整 render host 与 canvas export 接入方式，使 exporter 注册/注销和 cleanup 与统一 lifecycle 对齐

## 3. 示例迁移与验证

- [x] 3.1 在脚手架模板或现有复杂 tool 中接入统一 host lifecycle，验证 PreviewCanvas、FullStage 和 render host 场景
- [x] 3.2 补充测试并运行构建，确认生命周期统一后没有引入会话重建、资源泄漏或 exporter 残留
