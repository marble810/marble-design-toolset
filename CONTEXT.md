# Deshelf

Deshelf 是一个用于开发、加载和运行 Visual Tool 的设计工具体系。它让 Visual Tool 专注具体视觉效果，同时复用统一的构建、运行环境与 Workspace 体验。

## 产品与宿主

**Deshelf**:
整个产品品牌，包括 Web 与 Desktop 两种应用形态。
_Avoid_: Visual Tool Platform, Marble Design Toolset

**Deshelf Web**:
运行构建期已编译并进入静态 Catalog 的 Visual Tools 的 Deshelf 应用。
_Avoid_: Web Framework, Runtime Tool Loader

**Deshelf Desktop**:
通过 Open Project 打开 Tool Project，并运行其构建结果的 Deshelf 桌面应用。
_Avoid_: Electron Framework

**Deshelf Forge**:
Deshelf 面向 Visual Tool 作者的框架子品牌，涵盖开发模型、构建约定、Catalog extraction、Framework Libraries 与 Environment API。
_Avoid_: Deshelf Framework, DeFramework, ProvideModules

**Deshelf Host**:
消费 Catalog、创建 Tool Session、持有 Parameter Store，并提供 Standard Inspector、Workspace、Environment Inventory 与 diagnostics 的运行宿主。
_Avoid_: SubToolsManager, Tool Manager

**Host UI**:
Deshelf Host 的宿主表现层，负责 Workspace、Standard Inspector、操作反馈与界面局部状态；不持有应用运行的权威状态。
_Avoid_: 前前端, Front-front-end, Host Core

**Host Core**:
Deshelf Host 的宿主应用核心，负责应用用例、权威状态、规则与运行协调；它不表示远程服务器或原生进程。
_Avoid_: 前后端, Client Backend, BFF, Deshelf Host 的同义词

**Native Services**:
Deshelf Desktop 提供编译、系统 API 与原生 IO 的原生服务，不承载整个 Host Core。
_Avoid_: 后后端, Remote Backend, Tool Container

**Platform Adapters**:
Deshelf 应用核心访问平台能力的适配边界，连接浏览器能力或 Desktop 原生服务。
_Avoid_: Environment API, Native Services 的同义词

**Mock Host Core**:
供 Host UI 原型使用的应用核心替身，以内存状态和可控场景提供数据、状态变化与操作反馈，不是真实 Tool 运行引擎。
_Avoid_: Mock Server, Fake Environment API, Prototype Session Engine

**Environment API**:
Deshelf Host 与 Tool Container 之间轻量、统一的运行管理 interface；Web 与 Desktop 保持相同语义并使用不同 transport adapters。它用于环境供给与状态同步，不是防御恶意 Tool 的安全协议，渲染和模拟热路径不经过该 seam。
_Avoid_: Tool Runtime Protocol, Capability Broker, Raw IPC, Ad-hoc postMessage

**Environment Inventory**:
Deshelf Host 根据 Catalog Entry 与当前应用环境为 Tool Session 准备的 Framework Libraries、Tool Surfaces、Asset Input 与 Export 能力清单；Visual Tool 不在运行时申请 Grant。
_Avoid_: Capability Declaration, Capability Grant, Permission Manifest

**Deshelf Runtime Config**:
由 Deshelf Host 持有、独立于 Tool Project 与普通界面偏好的运行配置；Web 与 Desktop 共用 interface，并通过各自 adapter 持久化 timeout 等运行政策。
_Avoid_: Tool Config, Forge Profile, Deshelf Settings

**Framework Library**:
由 Deshelf Forge 提供、版本化并在 Tool Container 中运行的图形或动画库。
_Avoid_: Third-party Package, Environment API

**Forge Profile**:
Deshelf Forge 中不可静默改变的构建环境版本，固定 TypeScript/Svelte toolchain、Framework Libraries 与相关构建行为；Visual Tool 通过 Profile 获得可重复的 Tool Bundle。
_Avoid_: Library Profile, Dependency Latest, npm Profile

**Graphics Backend**:
Visual Tool 用于产生 Visual Output 的图形平台，例如 WebGL2 或 WebGPU；Tool 可以声明有顺序的 Backend 选择，并允许某些 Backend 没有 fallback。
_Avoid_: Framework Library, Renderer Package

## Visual Tool 生命周期

**Visual Tool**:
可重复使用、能够产生完整 Visual Output 的程序，是 Deshelf 的核心领域对象。
_Avoid_: SubTool, Plugin

**Tool Project**:
用于开发一个 Visual Tool 的源码 Folder。
_Avoid_: Plugin Folder, Visual Document

**Tool Manifest**:
Tool Project 唯一的静态身份与 Forge environment 记录；它不保存 Parameter、Command、Inspector Tree、Tool Surfaces 或运行权限。
_Avoid_: Catalog Entry, Runtime Registration, Package Manifest

**Project ID**:
Tool Project 在移动或重命名后仍保持不变的不可变身份；相同 Project ID 可以存在于多个 Project Locations，显示名称和可读 slug 不承担身份职责。
_Avoid_: Folder Path, Tool Name, Slug

**Project Location**:
同一逻辑 Tool Project 在当前机器上的一个具体 Folder；本地构建缓存区分 Project ID 与 Project Location。
_Avoid_: Project ID, Tool Identity

**Catalog**:
Deshelf Forge 从有效 Tool Projects 生成的可用 Visual Tools 名录；Web 使用静态 Catalog，Desktop 为当前打开的 Project 维护 Catalog，作者不直接编辑。
_Avoid_: Hand-written Registry, Runtime Registration, Tool List

**Catalog Entry**:
Catalog 中对应一个已成功构建 Visual Tool 的可序列化记录，包含身份、Forge environment、Parameter、Command、Inspector Tree、Tool Surfaces 与 artifact references，不包含函数、DOM 或 Svelte components。
_Avoid_: Tool Manifest, Tool Registration Payload, Tool Bundle

**Tool Entry**:
Tool Project 以 `defineVisualTool` 描述 Visual Tool 的唯一 TypeScript 入口；Deshelf Forge 在构建期从中抽出 Catalog Entry，并把运行函数、Frame 内容与可选 Tool Slate 留在 artifacts 中。
_Avoid_: Canvas Entry, Inspector Entry, Multiple Tool Entries, Runtime Registration

**Tool Bundle**:
Tool Project 构建出的可运行产物集合，包含 Catalog Entry 引用的 artifacts。
_Avoid_: Tool Package, Plugin Bundle, Catalog Entry

**Tool Surface**:
Tool Session 在 Tool Container 中呈现的一块 UI；统一 Canvas 必须存在，Tool Slate 可选。
_Avoid_: Tool Entry, Host Panel, Standard Inspector

**Tool Container**:
Deshelf Host 为 Tool Session 供给的运行 realm，用于环境供给、统一管理和 Session 间隔离；它不是恶意代码安全边界，也不承诺进程隔离。
_Avoid_: Plugin Sandbox, Host DOM, Process Isolation Guarantee

**Main Container**:
Tool Session 中运行 Main artifact、Tool Entry callbacks、simulation 与 Canvas 的必需 Tool Container。
_Avoid_: Host Runtime, Slate Container

**Slate Container**:
Tool Session 中仅在 Catalog Entry 包含 Tool Slate 时创建的可选 Tool Container；它不与 Main Container 共享 JavaScript realm，也不阻塞 Canvas Ready。
_Avoid_: Main Container, Inspector Runtime

**Tool Session**:
Deshelf Host 从一个 Catalog Entry 创建的一次 Visual Tool 运行实例。
_Avoid_: Tool Instance, Mounted Tool, Runtime Registration

**Visual Output**:
Visual Tool 生成的最终图像、视频或其他视觉结果；Tool Entry 通过 `outputs` named map 声明稳定 Output ID、可序列化 descriptor 与 Main-only callback，Host 据此提供 Export UI，Canvas 不在 mount 后注册 exporter。
_Avoid_: Result File, Export Artifact, Runtime Exporter Registration

## Workspace

**Workspace**:
Deshelf Host 为当前 Tool Session 提供的工作区域，拥有 Standard Inspector、Canvas 与可选 Tool Slate slot。
_Avoid_: InspectorAndCanvasManager, Tool Shell

**Tool Info**:
通过 MainInfo 入口打开的 Visual Tool 信息视图，集中展示 Catalog Entry metadata、Forge Profile、Framework Libraries、Graphics Backend 与 Environment Inventory。
_Avoid_: Inspector Section, Install Permission Dialog, Capability Grant View

**Inspector**:
由 Deshelf Host 渲染、用于查看和编辑 Tool Parameters 的 Standard Control 区域；Tool Slate 是其下方独立的 Tool Surface，不属于 Inspector Tree。
_Avoid_: Control Panel, Properties Manager, Tool Slate

**Standard Control**:
由 Deshelf Host 根据 Inspector Tree 呈现的标准 Parameter 控件。
_Avoid_: Tool-authored Standard UI, Built-in Widget, Default Field

**Parameter Set**:
一个 Visual Tool 的全部 Tool Parameters，以唯一且逻辑扁平的 Parameter ID 为 key 组织，并由 Deshelf Host 持有。
_Avoid_: Nested Parameter Store, Separate Computed Parameter Collection

**Asset Slot**:
Visual Tool 在 Tool Entry 的 `assets` named map 中声明的一项类型化输入；map key 是稳定 Asset ID，Catalog 保存 descriptor，Deshelf Host 持有选择结果、迁移与资源释放，Tool Container 只通过 Environment client 获取内容。
_Avoid_: File Path Parameter, Tool-owned Picker, Capability Request

**Tool Parameter**:
由 Deshelf Host 持有、控制 Visual Tool 行为的类型化值；视觉层级由 Inspector Section 表达，不改变 Parameter Set 的扁平结构。
_Avoid_: Control Value, UI State, Nested Parameter

**Parameter Constraint**:
Tool Parameter 对合法值空间的类型化约束；数值 Parameter 必须声明上下限，其他类型使用与自身类型对应的约束。
_Avoid_: Generic Limit, UI-only Range

**Parameter Binding**:
一个 Tool Parameter 与一个 Inspector 输入之间的唯一关联；Tool Logic 和 Tool Slate 对 Parameter 的受控更新不构成第二个 Binding。
_Avoid_: Field Link, Two-way UI State

**Parameter Mode**:
Tool Parameter 的写入规则，可为 manual、computed 或 overrideable；computed 显式声明依赖且不得形成循环，计算出非法值时保留最后一个合法值并产生 diagnostics；overrideable 在用户覆盖后保持手动值，直到恢复自动计算。
_Avoid_: Separate Computed Parameter Collection, Control Mode, Binding Type

**Inspector Tree**:
Visual Tool 在 `createInspector()` 中以线性 TypeScript 创建、由 Deshelf Forge 在构建期抽入 Catalog Entry 的 retained-mode Inspector Element 树；Tool Session 中 Deshelf Host 直接渲染真实 Standard Controls。
_Avoid_: Host DOM, Immediate-mode Repaint UI, Tool Slate, Runtime Registration

**Inspector Element**:
Inspector Tree 中可序列化的节点，例如 Label、Section、Slider、Toggle 或 Button；Element 可以绑定唯一 Tool Parameter、Tool Command 或私有 callback ID。
_Avoid_: DOM Element, Svelte Component

**Inspector Hint**:
Tool Parameter 在 Host 自动生成 Inspector Tree 时提供的非状态提示，例如 label、section、order、control、step 与可见条件；Hint 不重复定义 Parameter Constraint。
_Avoid_: Inspector Tree, Parameter Constraint

**Tool Command**:
Visual Tool 定义的一次性公开命令；其稳定 ID 来自 Tool Entry `commands` map key，TypeScript callback 留在 Main artifact并于 Main Container 中以 single-flight 执行，运行期间对应控件禁用，并受 Deshelf Runtime Config 中默认 10 秒的 timeout 约束。
_Avoid_: Tool Action, Boolean Parameter, Host Command

**Inspector Private Callback**:
仅供 Inspector Element 调用、不会进入公开 Tool Command map 的 Main-only callback；Tool 作者在 Tool Entry `privateCallbacks` named map 中以 key 定义稳定 ID，`createInspector` 绑定 typed handle，Catalog 只保存 callbackId，禁止 inline anonymous callback。
_Avoid_: Anonymous Inspector Handler, Public Tool Command, Runtime Callback Registration

**Tool Slate**:
挂载在 Inspector 下方 Host-owned slot 中的可选 Tool Surface；其 DOM、Svelte、HTML、CSS、局部状态与动态结构均由 Visual Tool 自己持有，定位类似 NDS 下屏，不属于 Inspector Tree。
_Avoid_: Inspector Extension Surface, Auxiliary Surface, Unreal Slate

**Canvas**:
Workspace 中由 Deshelf 统一管理、用于排列 Frame 并浏览其内容的视觉工作区域；同一时刻只呈现一个 Tool Session 的视图。
_Avoid_: Tool-authored Canvas, Frame, HTMLCanvasElement

**Canvas Ready**:
统一 Canvas 已可操作且初始 Frame 结构已建立的生命周期状态；Frame 可以为空或仍在加载，不代表所有视觉结果已就绪。
_Avoid_: All Frames Ready, First Output Ready

**Frame Definition**:
Visual Tool 对一类视觉内容的可复用定义；同一个定义可以产生零个或多个 Frame。
_Avoid_: Frame Instance, Visual Output

**Frame**:
Frame Definition 的一个具有独立逻辑尺寸和内容边界的运行时视觉实例，可以展示最终效果、中间态或调试内容；它是视图，不等同于可导出的 Visual Output。
_Avoid_: Visual Output, Export Artifact

## 作者工作流

**Author Mode**:
Deshelf Desktop 中用于启用 Tool Project watcher、build diagnostics 和 Reload Tool 的作者工作模式。
_Avoid_: dev_mode, Developer Mode, Debug Mode

**Reload Policy**:
Author Mode 中决定新 Tool Bundle 何时替换当前 Tool Session 的用户偏好，可选择 Immediate、Prompt 或 Manual。
_Avoid_: Hot Reload Mode, Project Setting

**Reload Tool**:
重新构建并抽取 Tool Project、更新其 Catalog Entry，再以成功的新 Tool Bundle 并行创建 replacement Session 的 Host Command；新 Canvas Ready 后原子切换，失败时保留旧 Session。
_Avoid_: Restart Tool, Reset Tool, Reset Defaults

**Restart Tool**:
不重新构建 Tool Project，直接使用当前 Catalog Entry 与 Tool Bundle 创建新 Tool Session 的 Host Command；用于恢复 Failed 或 unresponsive 的 Tool Container。
_Avoid_: Reload Tool, Reset Defaults

**Reset Defaults**:
把 manual 与 overrideable Parameters 恢复为默认值并重新计算 computed Parameters 的 Host Command；它不重新构建 Tool Project，也不替换 Tool Container。
_Avoid_: Reload Tool, Reset Default
