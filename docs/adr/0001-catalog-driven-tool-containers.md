---
status: accepted
---

# 使用构建期 Catalog 与轻量 Environment API

Deshelf 采用构建期 extraction 生成 Catalog Entry，Host 仅凭 Catalog 建立 Parameter Store 与 Standard Inspector，再以 `boot` 启动 Main/Slate Tool Containers。我们放弃运行时 Registration、Capability Broker 和对抗式 sandbox protocol，因为 Web Tool 已预编译且产品目标是性能优先的环境供给与 Session 隔离；代价是 same-origin Web iframe 不承诺恶意代码或进程级故障隔离。

## Consequences

- Web 与 Desktop 共用 Catalog Entry、Environment API 和 Tool Session 语义，只替换 Tool Source 与 transport adapters。
- rAF、GPU、simulation state 与 Canvas pixels 留在 Tool Container 内。
- Forge extraction 必须在受控 realm 中完成确定性 validation。
- Desktop 的文件与 Export 确认属于 environment adapter，不进入 Capability/Grant 模型。
