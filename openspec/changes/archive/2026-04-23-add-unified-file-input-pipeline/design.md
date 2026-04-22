## Context

当前 Marble Design Toolset 已经有两类比较明确的 framework-owned runtime 模式：

- 一类是与壳层强绑定的 context 能力，例如 canvas export，由 `ToolShell` 顶层注入后供左面板、右面板和工具子树共享。
- 另一类是工具可直接导入的运行时工具与类型，例如 tech stack registry、tool registry、workspace state 纯函数。

文件输入更接近第二类能力。它需要统一浏览器文件 API 的接入方式，但不会影响 workspace shell 的布局、catalog discovery 或 tool metadata。后续工具会把图像、影片、文字文件作为数据来源，因此框架需要提供：统一的文件类别声明、统一的 picker / drop 入口、统一的读取结果结构，以及统一的资源释放约束。

约束如下：

- 继续沿用浏览器原生文件 API，不为首版引入新的重型依赖。
- 不改变现有 tool schema，也不要求工具在 `metadata.json` 中新增输入声明。
- 共享文档与 OpenSpec artifact 继续使用中文；工具运行时共享 UI 文案约束不在本次设计范围内。

## Goals / Non-Goals

**Goals:**

- 提供一个 tool 可直接导入的统一文件输入管道，覆盖 image、video、text 三类文件。
- 让文件选择与拖放输入走同一条标准化 ingest 路径，减少工具侧重复代码。
- 为成功结果、失败结果与临时资源生命周期定义一致的数据契约。
- 让后续工具能够在不重新实现 MIME 过滤、对象 URL 回收和元信息解析的前提下消费输入文件。

**Non-Goals:**

- 不在本次变更中提供 framework-owned 的上传面板、拖放容器或左面板统一 UI。
- 不覆盖任意二进制文件、目录导入、剪贴板粘贴或远程 URL 抓取。
- 不在首版中解决多文件编排、时间轴管理、批量导入或持久化缓存。
- 不把文件输入结果自动接入导出、文档浏览或工具 metadata 发现链路。

## Decisions

### Decision: 采用工具直引的 file-input runtime，而不是壳层 context

文件输入状态天然属于具体工具实例，而不是 workspace 级共享状态。因此实现将新增 `src/lib/runtime/file-input/` 与 `src/lib/types/file-input.ts`，由工具组件直接 import 使用，而不是扩展 `ToolShellContext` 或在 `metadata.json` 中声明输入能力。

这样做的原因：

- 避免把只在工具内部使用的临时输入状态提升到壳层。
- 不增加 catalog discovery 与 lazy runtime definition 的耦合面。
- 与现有 `tech-stack`、`workspace-state` 这类“工具主动拉取”的运行时模式一致。

备选方案：把文件输入注册为 context 服务，由 `ToolShell` 顶层注入。否决原因是文件输入没有跨 panel 的共享刚需，且会迫使所有工具承担无意义的 context 装配成本。

### Decision: 用“状态控制器 + 纯解析辅助函数”拆分实现

实现按两层拆分：

- 状态控制器：使用 `.svelte.ts` 暴露可响应的输入状态与动作，例如 `busy`、`currentItem`、`lastError`、`accept`、`pick()`、`ingestFiles()`、`clear()`、`dispose()`。
- 纯解析辅助函数：负责 MIME / 扩展名映射、文件类别判定、元信息读取、对象 URL 生命周期辅助与 drop 数据抽取，便于独立测试。

这样可以让工具在 Svelte 组件中直接消费响应式状态，同时把最容易回归的浏览器兼容逻辑隔离成纯函数测试。

备选方案：只暴露一组无状态 helper，让每个工具自己维护状态。否决原因是这会把错误处理、busy 状态与资源释放逻辑重新分散回各个工具。

### Decision: 统一输出 discriminated union 的标准化输入结果

成功 ingest 后，运行时输出统一的 `ImportedFileItem` 联合类型，包含共享字段与 kind 专属字段：

- 共享字段：`kind`、`source`、`file`、`name`、`mimeType`、`size`、`lastModified`。
- image：额外包含 `objectUrl`、`width`、`height`。
- video：额外包含 `objectUrl`、`width`、`height`、`duration`。
- text：额外包含 `text`。

其中 image / video 通过框架创建的 object URL 作为后续工具预览的稳定入口；text 直接缓存解码后的字符串内容。首版使用 `file.text()` 读取文本，用 `Image` / `HTMLVideoElement` 元信息加载解析尺寸与时长。

备选方案：只返回原始 `File`，让工具自行读取。否决原因是那样无法真正形成统一管道，类型、错误语义和清理责任仍会重复实现。

### Decision: picker 与 drop 共用同一 ingest 入口，并由 allowed kinds 派生 accept 约束

运行时控制器接收 `allowedKinds` 配置，例如 `['image', 'text']`。该配置一方面用于生成标准化的 `accept` 字符串，供工具的隐藏文件输入元素复用；另一方面也用于在 ingest 阶段做最终校验。拖放进入的文件与 picker 选中的文件都必须调用同一个 `ingestFiles(files, source)` 入口。

这样可以保证：

- 文件选择器提示与运行时实际过滤规则一致。
- 工具不会因为入口不同而出现分叉的错误语义。
- 后续若增加 paste 或其它入口，也可以接到同一条 ingest 流水线。

备选方案：picker 仅依赖 `accept`，drop 单独做解析。否决原因是浏览器不会保证 `accept` 成为最终约束，仍然需要运行时层做一次统一校验。

### Decision: 失败导入不清空最近一次成功结果，清理责任由 runtime 持有

运行时会显式区分 `currentItem` 与 `lastError`。当新一次 ingest 因文件类型不支持、文本读取失败、图像/影片元信息解析失败等原因出错时：

- `lastError` 更新为 typed error；
- 先前的 `currentItem` 保持不变；
- 只有当新的 ingest 成功提交后，才释放旧的 object URL 并替换成功结果。

此外，控制器必须提供 `clear()` 与 `dispose()`：

- `clear()` 清空当前结果和错误，并回收 runtime 创建的 object URL。
- `dispose()` 用于组件卸载时做最终资源回收，避免工具切换后遗留 blob URL。

备选方案：失败时清空旧结果，或要求工具自己 revoke URL。否决原因分别是用户体验更差，以及容易形成资源泄漏和行为不一致。

## Risks / Trade-offs

- [影片元信息加载依赖浏览器媒体栈] → 通过独立 helper 包装 `loadedmetadata` / `error` 监听，并为失败路径提供稳定错误码，避免 tool 侧直接接触底层事件细节。
- [对象 URL 生命周期容易泄漏] → 由 runtime 集中创建与回收 URL，工具只消费结果，不直接承担 revoke 责任。
- [首版不支持多文件导入可能限制部分工具] → 在控制器 API 中保留批量 ingest 的扩展空间，但首版明确只承诺单次提交一个当前结果，复杂批处理另开 change。
- [文本读取默认使用 `file.text()`，编码能力有限] → 首版只保证浏览器默认文本解码路径；若后续工具需要显式编码选择，再增量扩展能力而不是提前复杂化首版实现。

## Migration Plan

本变更是增量新增能力，不涉及现有工具的强制迁移。

实施顺序：

1. 新增 `src/lib/types/file-input.ts` 与 `src/lib/runtime/file-input/`。
2. 为类别判定、标准化结果、错误路径与资源回收补充测试。
3. 补充工具开发文档，说明如何在 tool 组件中接入控制器、隐藏文件输入与拖放入口。
4. 同步更新 `AGENTS.md` 与相关 Copilot skill references，把“图像 / 影片 / 文字输入应优先复用统一文件输入管道”写入框架约束与工具开发阅读材料。
5. 在后续真正需要文件输入的工具中逐步采用，不要求一次性改造现有全部工具。

若实现阶段发现设计不成立，可以整体回滚该新增模块而不影响现有 tool runtime、workspace shell 或 metadata 合约。

## Open Questions

暂无阻塞当前 proposal 的开放问题。

后续如果出现真实工具需求，再评估是否需要单独扩展以下方向：多文件批处理、显式文本编码选择、剪贴板输入、目录导入。