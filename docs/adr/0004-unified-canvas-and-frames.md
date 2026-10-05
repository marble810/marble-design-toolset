# ADR 0004：统一 Canvas 托管与动态 Frame

状态：已接受。日期：2026-09-07。

Deshelf 统一管理每个 Tool Session 的 Canvas，让 Visual Tool 专注 Frame 内容，而不是各自实现画布导航与布局。采用可动态实例化的 Frame 模型，但不把它扩展成跨工具的文档编辑器，也不把画布排列等同于 Visual Output。

本 ADR 记录已接受的目标模型，不宣称当前代码已实现该模型或通过性能验证。术语以 [CONTEXT.md](../../CONTEXT.md) 为准；逻辑分层及原型边界继续遵循 [ADR 0003](0003-host-ui-core-native-services.md)。

## 1. Canvas 与作者边界

- 一个 Canvas 在同一时刻只呈现一个 Tool Session 的 Frames；不支持多个 Session 共用一张内容画布。
- Canvas 的外层布局、导航、Frame 标题栏与排列交互由 Deshelf 统一管理。Tool 不自写这些部分，也不重新定义 Workspace shell 或渲染 Host panels。
- Tool 在唯一 Tool Entry 中声明 Frame Definition；Forge 在构建期抽取其可序列化声明进入 Catalog，Frame 内容按需动态 import。Tool Manifest 仍只保存静态身份与 Forge environment 信息。
- 运行时 Frame 可以由参数、素材或 Tool 自身运行数据驱动，数量允许为零。例如批量计算每完成一项即可出现一个 Frame，不必为此新增 Tool Parameter。
- 动态实例只能使用已经声明的 Frame Definition；实例变化不是新的 Tool 注册入口，也不允许挂载后注册 exporter。
- Frame 需要稳定的逻辑身份，供布局更新与 Session 替换时匹配同一视图；不能把当前数组下标误当成可随排序变化的身份。具体 API 与 ID 编码不在本 ADR 中冻结。

## 2. 视图、尺寸与输出分离

Frame 可以展示最终效果、中间态、调试视图，或同一结果的不同视图；它不必对应一个可导出的 Visual Output。

区分 Frame 的逻辑尺寸、屏幕上的显示尺寸、视图缩放倍率与渲染分辨率。把一个 1024×1024 Frame 缩到 25% 观看，不会把它的逻辑尺寸变成 256×256，也不自动改变 Tool Parameters、模拟精度或导出尺寸。

用户排列 Frame 只改变观看布局，不向 Tool 提供用于模拟、计算或导出的排版数据。布局与视口属于 Host 管理的界面状态，不成为第二份 Parameter Store。排版类 Tool 如需把排列作为业务数据，应在自己的 Frame 内容中建模。

Visual Output 继续独立声明；不自动导出 Frame 控件、标题栏、整张 Canvas 或其布局。Tool 可以显式共用尺寸参数，但导出不隐式依赖视口缩放或 Frame 的屏幕显示尺寸。

Frame 内容类型不设置白名单，允许图形内容以及普通 HTML／Svelte 界面。此自由不取消 Frame 内容范围、宿主界面和 Parameter 权威边界；功能放置通过开发者指南引导，而不是以内容类型限制代替。

## 3. 导航、内容交互与排列

采用两个显式模式，首次打开默认导航模式：

| 模式 | Frame 内容区的输入 |
| --- | --- |
| 导航模式 | 用于统一 Canvas 的导航，不交给 Tool 操作内容。 |
| 内容交互模式 | 交给对应 Frame 的 Tool 内容处理。 |

Frame 标题栏始终由 Deshelf 管理，拖动标题栏移动该 Frame，不与内容拖拽混用。宿主工具栏提供明确的模式切换入口，Escape 返回导航模式；IME 组合输入优先处理。模式切换必须正确结束进行中的拖拽与按下状态，避免残留输入。

排列规则：

- Tool 可以提供新 Frame 的初始位置建议；未提供时由 Deshelf 自动放置。
- 初始建议不持续覆盖已有位置。用户可以自行拖动 Frame，且允许 Frame 重叠。
- 新增、删除或尺寸变化不自动重排已有 Frame；尺寸变大造成重叠也不暗中推动其他 Frame。
- 用户显式执行 Auto arrange 时，Deshelf 才重新整理位置。
- 重叠 Frame 使用稳定的前后顺序；具体放置算法、命中与层级操作细节留给后续实现设计。

首版包含单 Frame 拖动、Auto arrange、Fit all 和 100% 等基本导航操作。不包含用户增删或调整 Frame 尺寸，也不包含布局撤销重做、多选、对齐和吸附。

## 4. 视图状态与生命周期

手动位置、平移和缩放保留到当前工作区关闭。同一工作区内 Restart／Reload 时，依据稳定 Frame 身份恢复布局和视口；新身份的 Frame 使用初始放置策略。工作区关闭后不承诺恢复，不在首版引入磁盘布局存档。

Reset Defaults 仍是 Parameter 操作，不承担重置画布布局的职责；由参数变化引起的 Frame 变化继续遵循上述排列规则。

Canvas Ready 的门槛是统一 Canvas 已可操作，且初始 Frame 结构已建立。初始结构可以为空，Frame 也可以仍处于加载状态；它不代表所有结果的第一幅画面已经完成。

因此，Reload 保持 staged replacement：

- 新 Canvas Ready 后原子切换，允许新画布包含加载占位。
- 单个 Frame 可独立显示加载、内容或错误状态；可归属到该 Frame 的视图加载／挂载失败，不使整个 Session 自动失败。
- 构建、extraction、共享 Main 或统一 Canvas 基础设施在切换前失败，仍保留旧 Session。
- 局部错误展示不是故障隔离。共享 Main 逻辑崩溃或阻塞，仍可能影响其他 Frames 与整张 Canvas。

## 5. 运行位置与性能边界

选定统一 Canvas 系统与 Frame 内容共同运行在 Main Container 的方向：

```text
Workspace（Host 管理）
└─ Main Container
   ├─ Deshelf 提供的统一 Canvas 系统
   └─ Tool 提供的 Frame 内容与共享运行数据
```

执行位置不改变所有权：统一 Canvas 是 Deshelf 提供的表现层设施，不是 Tool 自定义外壳；Host Core 仍持有 Parameter Store 与 Session 权威状态。Tool Slate 继续使用独立 Slate Container，不阻塞 Canvas Ready。

多个 Frame 可共享同一 Tool 的模拟、素材和渲染资源，不要求每个 Frame 一个 iframe、realm 或 Tool Session。Web 继续使用 same-origin iframe，Desktop 继续使用 WebContents + MessagePort，两端共用容器内的统一画布实现方向。

rAF、GPU 绘制、simulation state 与像素留在 Tool Container。连续导航与拖拽的实时处理也留在容器内，不做成逐帧 Host 往返；运行管理元数据及可恢复的视图状态快照按需同步。统一托管不是“Tool 传像素给 Host，再由 Host 重绘”。

选择此方向，是为了在保留任意 Frame 内容和共享 Tool 运行资源的同时，避免为 Web 与 Desktop 分别维护一套画布交互实现。Desktop 的 WebContentsView 不是 Host DOM 子元素，不能直接假设 Host CSS transform 就能实现两端统一缩放。

代价是共享 Main 的阻塞可能波及整张画布；本方案不新增 Frame 故障隔离保证，也不改变 Web 不承诺故障隔离、Container 不是恶意代码安全边界的约定。

## 6. 迁移取舍

现有单 Canvas 工具直接迁移到 Frame 声明模型，不保留把旧 Canvas 包装成单 Frame 的兼容路径，也不保留 Tool 自定义整张 Canvas 的旁路。

旧 MDT 到新 Deshelf 的迁移采用破坏性重构，兼容策略遵循 AGENTS.md。该选择减少双轨作者模型及旧 surface 尺寸／导出语义的长期维护成本，但要求现有工具迁移。仍须明确处理 contractVersion 与 Forge Profile，不能静默改变不可变的构建环境。

## 7. 验证门槛与后续范围

架构方向已经选定，以下能力尚须在真实 Web／Desktop 链路验证，不能用 Mock UI 原型代替：

- 缩放和平移后的输入坐标、标题栏拖动、焦点、Escape、IME 与拖拽取消。
- 动态 Frame 增删与尺寸变化、空画布、稳定身份匹配，以及 Restart／Reload 的布局和视口恢复。
- 多 Frame 的独立加载／错误显示、Canvas Ready、切换前失败保留旧 Session。
- 以 1、8、32 个 Frame 为代表性负载，在固定内容和渲染分辨率下，对比基线与统一 Canvas 的导航响应、帧耗时和资源占用。

上述数量是首版验证范围，不是已经证明的性能能力，也不自行成为 Frame 数量的 API 上限。详细声明 API、元数据格式、自动布局算法、缩放与资源限制、性能预算在后续实现设计和实测中明确。

独立 UI 原型仍只验证界面与 Mock Host Core 状态，不复用或接入本仓库的真实 Canvas 运行设施、Host Core、Tool Container 或 Native Services。

开发者功能放置指南已列入 Backlog：[MAB-71：编写 Frame 内容与 Inspector／Tool Slate 的开发者使用指南](https://linear.app/mabomabo/issue/MAB-71)。本次不编写指南；其承载位置另定，不恢复 docs/ 开发手册或文档站。
