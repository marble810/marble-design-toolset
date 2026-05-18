## Context

当前仓库的 IO 能力已经自然分成三层：`runtime/file-input` 负责底层文件读取与标准化，`runtime/io` 提供更接近 tool 的 source abstraction，`components/tool-io` 提供可直接复用的 UI。方向是对的，但工具作者进入系统时仍然需要先理解三层关系，文档和示例也没有始终把一个推荐入口放在最前面。

因为项目目标是开放插件式结构，本次设计不打算把 IO 入口强制收缩成唯一实现，而是明确“默认 public path”和“底层 escape hatch”的关系。

## Goals / Non-Goals

**Goals:**
- 为 tool 作者明确一个默认推荐的 IO 接入路径。
- 保留底层 `file-input` pipeline 作为高级自定义的 escape hatch。
- 让 docs、脚手架和 shared UI 围绕同一套 IO 心智模型组织。
- 减少“作者要先懂内部实现才能知道从哪层开始用”的情况。

**Non-Goals:**
- 不重写 `file-input` 的底层读取和错误语义。
- 不把 `tool-io` 变成新的大而全 export/runtime 杂项层。
- 不移除底层 `file-input` 直连能力。
- 不把 workspace persistence 或非文件类 IO 拉进本次范围。

## Decisions

### 决策 1：明确三层职责，而不是合并成一层

保留三层结构，但重新定义默认入口：
- `file-input`: 底层 primitive
- `runtime/io`: tool-facing source facade
- `components/tool-io`: 可选 UI layer

相比“一刀切合并目录”，这种职责清晰化的收益更高，也能保留 escape hatch。

### 决策 2：脚手架和文档默认从 `runtime/io` 起步

对于绝大多数 tool，作者首先需要的是“一个可用的 source workflow”，而不是自己重新拼底层 controller。因此脚手架和文档默认指向 `runtime/io`，只有在需要深度自定义时才下潜到 `file-input`。

### 决策 3：tool-io 继续只承载文件来源相关 facade 与 UI，不吞并其他 runtime

`tool-io` 已经承担 source workflow、drop 绑定、摘要和下载 primitive 等高层能力。本次强调它的 public role，但不让它继续膨胀到承载 canvas export、workspace state 或其他不相干能力。

### 决策 4：保留 escape hatch，并把它写进文档 contract

插件式结构的关键不是“只有一条路”，而是“有推荐路径，同时允许更低层接入”。因此需要在规范中明确：tool 可以直接使用 `file-input`，且这种能力不会因高层 facade 的存在而被破坏。

## Risks / Trade-offs

- **[Risk] 三层仍然存在，作者还是觉得入口多** → Mitigation：用文档和脚手架把默认入口前置，减少第一次接触时看到的层数。
- **[Risk] tool-io 职责继续膨胀** → Mitigation：在 spec 中明确它只服务文件来源类 facade 与 UI。
- **[Risk] 过度强调 facade，导致高级需求难实现** → Mitigation：保留底层 primitive 并把 escape hatch 写入 contract。

## Migration Plan

1. 明确三层职责与推荐入口。
2. 调整 docs 与 scaffold，使其默认从 `runtime/io` 和 `components/tool-io` 讲起。
3. 逐步更新示例 tool 的导入路径和说明文字。
4. 保留底层 `file-input` 直连能力，不做破坏性迁移。

## Open Questions

- 是否需要为 `runtime/io` 单独提供更明显的 public 入口名，以减少与其他 IO 概念混淆。
- `components/tool-io` 是否需要围绕 recipe 增加更明确的最小示例集合。
