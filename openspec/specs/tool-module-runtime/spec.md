# tool-module-runtime Specification

## Purpose
TBD - created by archiving change establish-pixel-tool-framework. Update Purpose after archive.
## Requirements
### Requirement: 每个工具遵循严格的文件系统 schema
每个工具 SHALL 位于 `src/tools/<tool-id>/` 之下，并且 SHALL 提供 `index.ts`、`metadata.json` 以及一个文件名与工具标识 PascalCase 形式严格对应的 master Svelte 入口组件。该工具的其他 Svelte 文件 SHALL 位于 `components/` 目录中。

#### Scenario: 仓库中新增一个工具
- **WHEN** 贡献者创建一个新的工具模块
- **THEN** 该工具包含 `index.ts`、`metadata.json`、一个位于工具根目录中的 master 入口组件，以及仅位于 `components/` 下的私有 Svelte 子组件

#### Scenario: 贡献者检查工具目录
- **WHEN** 贡献者查看某个工具目录的根目录
- **THEN** 该目录中恰好存在一个 root-level 的 Svelte 入口组件

### Requirement: 每个工具暴露运行时定义
每个工具 SHALL 暴露一个运行时定义，其中包括 metadata、可选 menu actions、可选 tech-stack 声明，以及 master 入口组件的懒加载器。

#### Scenario: 运行时解析工具定义
- **WHEN** 工作区运行时加载某个工具定义
- **THEN** 它可以从该定义中读取工具 metadata、menu actions、声明的 tech stack 以及懒加载组件加载器

### Requirement: 工具 metadata 可在不加载运行时代码的前提下被发现
工作区 SHALL 对所有工具 metadata 进行 eager discovery，同时保持工具运行时定义和入口组件延迟加载。

#### Scenario: 壳层需要工具目录清单
- **WHEN** 工作区在任何工具尚未打开前渲染工具列表
- **THEN** 它可以读取每个工具的 name、description、tags 和 version，而不加载该工具的运行时定义或入口组件

#### Scenario: 某个工具尚未被打开
- **WHEN** 工作区当前仅显示壳层空态或另一个工具
- **THEN** 未打开工具的入口组件不会仅为了填充工具目录而被加载

### Requirement: 可选技术栈通过共享 registry 声明与加载
运行时 SHALL 支持以 `three`、`pixi` 和 `gsap` 为 key 的共享、缓存、动态加载技术栈，并且 SHALL 仅在已打开工具声明这些依赖时才加载它们。

#### Scenario: 工具声明渲染或动画技术栈
- **WHEN** 某个工具定义声明 `three`、`pixi` 或 `gsap`
- **THEN** 工作区在挂载该工具前通过共享 registry 加载缺失模块

#### Scenario: 两个工具声明同一技术栈
- **WHEN** 第二个工具在同一技术栈已经完成加载后被打开
- **THEN** 运行时复用缓存中的模块，而不是再次加载

### Requirement: 工具内容使用壳层拥有的 panel 包装组件
每个工具的 master 入口组件 SHALL 通过壳层拥有的 panel 包装组件组织自身 UI，从而让工具专属 UI 仅出现在其左侧和右侧 panel 区域内部。

#### Scenario: 工具组合私有 UI 片段
- **WHEN** 工具 master 组件从自身的 `components/` 目录导入私有子组件
- **THEN** 这些子组件只在该工具自己的左面板或右面板内容树内部渲染

#### Scenario: 工具提供菜单动作或 metadata 驱动信息
- **WHEN** 壳层渲染已挂载工具
- **THEN** 壳层可以注入基于 metadata 的信息区块和菜单动作，而无需工具重新定义工作区外框

