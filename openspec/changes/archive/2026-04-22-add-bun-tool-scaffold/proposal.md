## Why

当前仓库已经有明确的 tool contract、目录 schema 与运行时装载协议，但新增一个 tool 仍然依赖开发者手动拼装 metadata.json、index.ts、master 组件和私有 components 目录。这个流程重复、容易出错，也让新工具作者很难获得类似 create-vite 那样快速、确定的起步体验。

这次变更希望引入一个基于 Bun 的交互式脚手架命令，在不改变现有 tool runtime contract 的前提下，快速生成符合仓库规范的空工具骨架，并把常见选择如 tool 名称、右侧 starter 类型和 tech stack 声明收束为统一 prompt 流程。

## What Changes

- 新增一个仓库内开发者可执行的 Bun 脚手架命令，用于交互式创建新的 tool 模块骨架。
- 脚手架根据开发者输入生成符合现有 schema 的目录结构、metadata.json、index.ts、master Svelte 组件和私有 components 子组件。
- 脚手架支持为不同 starter 类型生成最小可运行外框，至少覆盖固定尺寸预览型和全出血 stage 型工具。
- 脚手架支持声明 three、pixi、gsap 等现有共享 tech stack，并把声明写入正确的 runtime definition 位置。
- 补充文档，定义脚手架的使用方式、生成约束、默认值和与现有 tool authoring guide 的关系。

## Capabilities

### New Capabilities
- `tool-scaffolding`: 提供交互式命令来生成符合仓库规范的新 tool 骨架，并根据 starter 类型与 tech stack 选项输出最小可运行模板。

### Modified Capabilities

## Impact

- 受影响代码主要包括根目录脚手架入口、模板渲染逻辑、package 脚本以及可能新增的模板资源目录。
- 受影响文档包括 README 和 tool 开发指南，需要补充如何使用脚手架创建新 tool。
- 不改变现有 tool runtime schema、tool registry discovery 机制或 workspace shell 责任边界。
- 新能力依赖本地 Bun 运行时作为项目内开发者工具，但不改变生产构建与运行时依赖模型。