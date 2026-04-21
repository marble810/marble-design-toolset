## MODIFIED Requirements

### Requirement: 可选技术栈通过共享 registry 声明与加载
运行时 SHALL 支持以 `three`、`pixi` 和 `gsap` 为 key 的共享、缓存、动态加载技术栈，并且 SHALL 通过共享的 key-to-module 类型映射把每个 key 绑定到对应的静态模块 contract。工作区 SHALL 仅在已打开工具声明这些依赖时才加载它们。`loadTechStack` MUST 在调用方传入确定的单个 key 时返回该 key 对应模块的静态类型；`loadTechStacks` MUST 在调用方保留字面量 key 集合时返回与该 key 集合同步的类型结果，并在 key 信息被宽化时退回安全的通用映射类型。上述类型增强 MUST NOT 改变现有懒加载与缓存复用语义。

#### Scenario: 工具声明渲染或动画技术栈
- **WHEN** 某个工具定义声明 `three`、`pixi` 或 `gsap`
- **THEN** 工作区在挂载该工具前通过共享 registry 加载缺失模块

#### Scenario: 两个工具声明同一技术栈
- **WHEN** 第二个工具在同一技术栈已经完成加载后被打开
- **THEN** 运行时复用缓存中的模块，而不是再次加载

#### Scenario: 工具按单个 key 加载共享技术栈
- **WHEN** 工具代码调用 `loadTechStack('pixi')`、`loadTechStack('three')` 或 `loadTechStack('gsap')`
- **THEN** 返回结果在静态类型上分别对应各自模块 contract，而不是统一退化为 `unknown`

#### Scenario: 工具按字面量 key 集合批量加载共享技术栈
- **WHEN** 工具代码以保留字面量信息的 key 集合调用 `loadTechStacks`
- **THEN** 返回对象的可访问 key 与每个 key 对应的模块类型和请求集合保持一致