## 1. 依赖与样式基础层

- [x] 1.1 从项目中移除 TailwindCSS、Tailwind 的 Vite 集成以及 class 合并辅助工具。
- [x] 1.2 增加 `pixelarticons`、`gsap`、`pixi.js` 和 `three` 的运行时依赖。
- [x] 1.3 以共享 CSS Custom Properties、像素单位间距和 `<720px` 视口保护机制重建 `src/app.css`。

## 2. 共享 UI 原子组件与资源

- [x] 2.1 用基于 Bits UI 的包装层替换当前按钮和对话框实现。
- [x] 2.2 基于 Bits UI 增加下拉菜单、可折叠区块和标签页的共享包装组件。
- [x] 2.3 增加共享像素图标处理能力和共享 SVG border-image 资源。

## 3. 工作区壳层

- [x] 3.1 实现 ToolShell、LeftPanel、RightPanel、MainInfo、Section 和 PreviewCanvas 壳层组件集。
- [x] 3.2 实现包含 Open、Help 和 Settings 交互的工作区 Header。
- [x] 3.3 实现标签页模型，包括打开、激活、关闭和空状态行为。
- [x] 3.4 实现带左面板宽度持久化能力的设置对话框。
- [x] 3.5 实现预览舞台的 Fit、1:1、缩放、平移和棋盘格背景行为。

## 4. Tool 运行时与持久化

- [x] 4.1 增加 tool metadata、menu actions、runtime definition 和 tech-stack key 的共享类型。
- [x] 4.2 实现工具的 metadata eager discovery 与 runtime definition lazy loading。
- [x] 4.3 实现已打开标签页、活动工具和工作区设置的 URL hash 同步与本地持久化。
- [x] 4.4 实现支持 `three`、`pixi` 和 `gsap` 的共享动态加载 registry 与缓存机制。

## 5. Tool schema 迁移

- [x] 5.1 将现有工具重构为严格目录与命名 schema。
- [x] 5.2 把 aspect-ratio 工具迁移到由壳层拥有 panel 布局的组合模式。
- [x] 5.3 把 hello-world 工具迁移到同一 runtime 与 shell 契约中。
- [x] 5.4 删除旧的页面层 component map 和其他直接挂载工具的临时逻辑。

## 6. 仓库指引与验证

- [x] 6.1 创建记录 Bits UI 规则、仅英文文案、纯横屏约束和像素单位样式规则的仓库指引文件。
- [x] 6.2 更新仓库文档，说明工作区壳层、tool schema 和受支持的运行时技术栈。
- [x] 6.3 验证 build 输出、hash 恢复、本地持久化和 tech stack lazy loading 行为。