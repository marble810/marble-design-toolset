# Checkpoint 0001：前端设计基线

## 定位

- 记录日期：2026-09-07。
- 框架代码基线：`8c6083aeb9f25636f679228360c804d534e14379`（`fix: address MAB-70 migration review findings`）。
- 本记录包含基线之后的 Docs 清理；清理变更的提交以本文件的 Git 历史为准，本次操作未创建提交或 tag。
- 阶段判断：框架运行闭环已具备前端设计起点，不代表产品界面定型或完整发布验收。

## 本次变更

- 删除全部旧 `docs/` 内容，仅重新建立开发 checkpoint 记录。
- 删除 `src/routes/docs/` 页面、导航、阅读布局及 `src/lib/docs/` 加载、索引和专用测试。
- 移除 `mdsvex`、`rehype-highlight` 及 Markdown 编译配置，更新依赖锁文件；checkpoint 不参与前端构建。
- 重写 README 开发入口，清理当前源码失效引用，将必要框架约束保留在 AGENTS 中。
- 保留 CONTEXT 与 OpenSpec；OpenSpec 归档中对旧 Docs 的描述属于历史记录，不是当前功能入口或有效文件链接。
- 未修改 Tool 运行逻辑；未处理工作区原有未跟踪的 `.pi/`。

## 已有能力与落点

| 能力 | 当前实现位置与状态 |
|---|---|
| Tool contract、SDK 与构建期 Catalog extraction | `packages/tool-contract/`、`packages/tool-sdk/`、`packages/tool-builder/` |
| Session、Parameter Store、Inspector 与运行命令 | `packages/tool-host/`，含 Reload、Restart、Reset 相关测试 |
| Web Catalog 与 same-origin iframe Container | `src/lib/forge/`、`scripts/build-web-catalog.ts`；Web 应用仍在根 `src/`，不是 `apps/web/` |
| Desktop adapter | `apps/desktop/`，包含 WebContents、MessagePort、受控构建、资源输入与导出实现 |
| Tool 样本 | `tools/hello-canvas/`、`tools/shallow-water/`；本次构建产生两个可用 Catalog entries |
| 前端基础 | `src/app.css` CSS tokens、`src/lib/components/ui/` 基础组件，以及工程验证性质的 Host 页面 |

## 验证结果

以下命令于记录日期在清理后执行：

| 检查 | 结果 |
|---|---|
| `bun test` | 354 通过、0 失败；50 个测试文件，928 次断言 |
| `bun run typecheck` | 通过；覆盖 packages 与 Desktop TypeScript 配置，不等同于完整 Svelte 组件类型检查 |
| `bun run build` | 通过；静态 Catalog 与 Web 生产构建成功 |
| 构建目录检查 | `build/` 内未发现 Docs 命名的文件或目录 |

清理前为 356 个测试、51 个文件；减少的 2 个测试来自被删除的 Docs catalog 测试，不是运行框架测试被跳过。

## 已知限制与未验证项

- `ForgeInspector.svelte` 对 `entry`、`store` 的初始化引用仍产生 `state_referenced_locally` 警告；本次未修改其生命周期处理。
- 未执行浏览器完整交互、Web adapter smoke 或 Desktop 实机验收；单元测试和构建通过不替代这些检查。
- Web 使用 Svelte Host/Inspector，Desktop 使用 plain DOM Host/Inspector，视图组件尚未统一。
- Web Inspector 仍主要使用原生控件，未完整接入共享基础组件。
- 当前 Catalog/Host 页面面向工程验证；信息层级、面板尺寸和技术状态展示不应作为产品设计定稿。
- 窄屏目前主要通过 CSS 隐藏和覆盖提示处理；尚未验证其是否满足阻止正常工作区挂载和运行的要求。
- same-origin iframe 不承诺故障隔离；Tool 死循环可能卡死 Host，不能把 Restart UI 视为此场景的可靠恢复保证。

## 下一阶段

1. 明确 Web/Desktop 视图复用策略，再决定共享 Workspace 与 Inspector 的组件边界。
2. 设计 Workspace 信息架构和状态矩阵：Catalog 加载/空/失败、Tool 启动/失败/无响应、Reload 失败保留旧 Session、Asset/Export 反馈、有无 Slate、长 Inspector 与窄屏阻断。
3. 用 Shallow Water 实现打开、调参、运行、导出、恢复的完整流程，以 Hello Canvas 和状态 fixtures 验证通用性。
4. 保留运行契约与 Host/Tool 职责边界，允许重做视图布局和样式；具体硬约束以根目录 AGENTS 为准。

后续 checkpoint 按阶段新增编号文件，记录各自提交与实际验证结果；本记录是时间点快照，不扩展成文档站或持续维护的开发手册。
