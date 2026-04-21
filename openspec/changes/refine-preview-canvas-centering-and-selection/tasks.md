## 1. PreviewCanvas 中心锚点改造

- [x] 1.1 重构 PreviewCanvas 内容定位结构，改为“先以视口中心定位，再应用 pan/zoom 变换”的实现。
- [x] 1.2 调整 PreviewCanvas 的 transform 组合，确保 Fit、1:1 与手动缩放共享同一中心参考系。
- [x] 1.3 保持现有缩放状态与事件处理语义不变，避免引入与 zoom 模型无关的行为回归。

## 2. 框架级文本不可选策略

- [x] 2.1 在 PreviewCanvas 内容区添加框架级不可选文本样式限制（user-select）。
- [x] 2.2 验证拖拽平移与滚轮缩放过程中不再出现文本误选高亮。

## 3. 规格与文档一致性

- [x] 3.1 确认 PreviewCanvas 实现与本 change 的 delta specs（right-panel-modes、tool-shell-workspace）逐条对齐。
- [x] 3.2 更新相关开发文档中对 PreviewCanvas 行为的描述，补充中心锚点与不可选文本默认策略。

## 4. 回归验证

- [x] 4.1 在 Aspect Ratio 工具中验证大尺寸内容在初始、Fit、1:1、手动缩放下均以中心为参考显示。
- [x] 4.2 在 Noise Texture Creater 等常规尺寸工具中验证无视觉回归。
- [x] 4.3 运行仓库标准构建与测试命令，确认变更未破坏现有行为。