## Context

当前仓库已经把 tool module 的目录 schema、metadata 约束、runtime definition 和右侧面板模式固定下来，运行时通过文件落位自动发现新工具。这意味着“创建新 tool”本质上不是注册流程问题，而是一个需要稳定产出正确文件结构的 authoring workflow 问题。

目前新增 tool 需要开发者手动创建目录、命名 tool-id、编写 metadata.json、index.ts、master Svelte 组件，以及视情况补充 components/ 内的私有子组件。这个过程重复、容易偏离约定，并且与仓库已经形成的严格 contract 不匹配。用户希望补上一层 Bun 驱动的交互式脚手架体验，让创建新 tool 的流程更快速、更确定，但边界保持为当前仓库内的开发者命令。

## Goals / Non-Goals

**Goals:**
- 提供一个项目内开发者可执行的 Bun 命令，通过交互式 prompts 创建新的 tool 骨架。
- 将单一输入的工具名称规范化为 tool-id、PascalCase master 组件名和默认展示名，减少人工命名错误。
- 根据 starter 类型生成符合现有 panel contract 的最小模板，至少覆盖 PreviewCanvas 和 FullStage 两类常见场景。
- 根据开发者选择输出正确的 techStack 声明位置与最小占位代码，保持 metadata.json 纯静态。
- 在写文件前校验目标目录冲突，避免覆盖已有工具或生成半成品。

**Non-Goals:**
- 不改变现有 tool runtime contract、catalog discovery 或 workspace shell 责任边界。
- 该脚手架保持为项目内开发者命令，不设计为独立分发的 create 类包。
- 不生成复杂业务逻辑、真实 Three/Pixi 场景或完整动画，只生成可运行的空骨架与占位内容。
- 不覆盖所有可能的右侧展示形式；第一版不把“自由内容”做成单独 starter。

## Decisions

### 决策一：脚手架保持为仓库内 Bun 开发者命令

脚手架将以仓库内命令的形式提供，例如通过 package script 暴露为 `bun run create:tool`。这样可以直接复用仓库内已有约束、模板和文档，并把职责稳定限定在当前项目的作者工作流中，而不是引入额外的分发边界。

### 决策二：脚手架逻辑与模板资源放在根级脚本目录，避免混入应用运行时代码

脚手架属于 authoring tooling，不应进入 src/ 下的应用模块，也不应影响 SvelteKit 运行时打包边界。实现上应使用根级脚本入口，并将模板文件作为显式资源保存，而不是直接复制现有 demo tool 文件。

备选方案：
- 把模板字符串内联在单个脚本文件中：实现快，但模板可读性和后续维护性较差。
- 直接复制 `src/tools/hello-world` 或 `src/tools/three-cube`：示例工具可能为了展示能力而演进，不适合作为长期稳定的脚手架真源。

### 决策三：交互流程以“最少必要输入”为主，进阶 metadata 使用默认值

首版 prompts 以 tool name、starter type 和 tech stacks 为核心输入。脚手架基于名称自动推导 tool-id、PascalCase 组件名和默认英文显示名，并为 desc、tag、version 等字段提供稳定默认值。这样可以保留 create-vite 式的轻量体验，同时避免让开发者在第一次运行时被大量字段打断。

备选方案：
- 每个 metadata 字段都单独提问：灵活但冗长，违背“快速起步”的目标。
- 完全不提问、只依赖命令行参数：更适合自动化，不适合当前强调的交互式体验。

### 决策四：starter 只提供 preview 与 stage 两种主路径，并把模板差异收束在右侧容器与私有子组件

Preview starter 生成基于 `PreviewCanvas` 的固定尺寸预览骨架；Stage starter 生成基于 `FullStage` 的全出血宿主骨架。两者都保持相同的左侧 panel 结构，并在 `components/` 中生成一个私有子组件，让 root-level master `.svelte` 始终保持为唯一入口组件。

备选方案：
- 增加第三种“自由内容” starter：覆盖面更广，但对首版价值有限，会额外增加 prompt 分支和模板维护成本。
- 只提供单一模板并让开发者自行修改：实现最简单，但不能体现用户明确提出的不同技术路径。

### 决策五：tech stack 选择只影响 runtime definition 与相关模板，不改变依赖安装或 metadata 结构

脚手架只允许选择当前 runtime 已支持的 `three`、`pixi` 和 `gsap`。选中的 key 仅写入 `index.ts` 的 `techStack` 字段；`metadata.json` 保持纯静态。对于 `three` 和 `pixi`，脚手架在 stage starter 中生成更贴近渲染宿主的占位子组件；对于 `gsap`，仅保留 runtime declaration 与最小模板，不额外生成复杂动画逻辑。

备选方案：
- 在 metadata.json 中写入 tech stack：违背现有 contract。
- 在脚手架运行时动态安装依赖：仓库依赖已存在，动态安装会引入额外失败面且超出当前目标。

### 决策六：遇到目录冲突或非法目标时直接中止，而不是尝试合并

脚手架的职责是创建新工具骨架，不是增量修补已有工具。若目标 `src/tools/<tool-id>/` 已存在，命令应明确报错并退出，避免写出部分文件后再要求人工清理。

备选方案：
- 交互式询问是否覆盖：风险较高，容易误伤已有工作。
- 尝试只补齐缺失文件：会让脚手架同时承担迁移器职责，复杂度过高。

## Risks / Trade-offs

- [模板会与文档或最佳实践发生漂移] → 通过保持模板最小化，并要求 README 与 tool authoring guide 同步更新来降低漂移风险。
- [交互式流程对自动化不够友好] → 首版优先优化人工创建体验，后续若有需要再扩展命令行 flags 或无交互模式。
- [引入 Bun 作为开发者前置条件] → 将 Bun 明确限定为本地 authoring tooling 依赖，不影响生产构建与运行时。
- [两种 starter 可能被误解为唯一推荐架构] → 在文档中明确说明它们是常用起步模板，而不是对所有工具形态的限制。

## Migration Plan

1. 新增仓库内脚手架入口与模板资源目录。
2. 在 package 脚本中暴露统一命令入口，并补充使用文档。
3. 通过生成一个临时 tool 样例并执行构建验证，确认输出满足现有 runtime contract。
4. 在实现阶段保持脚手架职责收敛于项目内作者工作流，不扩展为外部分发工具。

## Open Questions

- 当前没有阻塞实现的开放问题。未来若出现自动化批量创建或 CI 使用场景，再评估是否为脚手架增加 flags、`--yes` 或非交互模式。