# Deshelf

Deshelf 是承载 Visual Tools 的横屏设计工作区，包含 Web 与 Desktop 两种应用形态。Deshelf Forge 在构建期生成 Catalog，Host 负责 Session、Inspector、资源输入与导出，Tool Container 负责 Canvas 和模拟运行。

## 开发

```bash
bun install
bun run dev           # 生成静态 Catalog 并启动 Web
bun run dev:desktop   # 启动 Desktop
bun run test
bun run typecheck
bun run build
bun run preview
```

Tool Project 位于 `tools/`，以 `manifest.json` 和 `index.ts` 为登记点；现有样本为 `hello-canvas` 与 `shallow-water`。

## 开发记录

- [前端设计基线 checkpoint](./docs/checkpoints/0001-frontend-design-baseline.md)
- [ADR 0003：Host UI、Host Core 与 Native Services 分层](./docs/adr/0003-host-ui-core-native-services.md)
- 框架硬约束：[`AGENTS.md`](./AGENTS.md)
- 领域术语：[`CONTEXT.md`](./CONTEXT.md)

`docs/` 仅保存开发 checkpoint 与 ADR，不提供前端 Docs 页面，不参与应用内容构建。旧文档与历史文档站可从 Git 历史查阅；OpenSpec 归档保留当时的描述，不代表当前实现。
