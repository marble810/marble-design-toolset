## Context

Marble Design Toolset 目前还是仓库内插件模型：tool 与 framework 同仓、同构建、同部署。这个阶段最重要的问题不是“不可信第三方插件沙箱”，而是**如何让 framework 演进不持续打碎 tool，tool 演进也不反向侵入 framework internals**。

对照外部案例，最适合当前阶段的做法已经比较清楚：

- **VS Code**：扩展运行在宿主边界内，并且只通过公开 API / exports 协作；internal commands 不构成公共 contract。
- **Backstage**：稳定 plugin API、services 和 extension points 是第一公民；插件之间不直接跨代码互调。
- **Grafana**：默认先走稳定 SDK，额外再提供可选 sandbox 作为更强隔离层。
- **Figma**：主线程 sandbox + iframe UI 的双环境隔离非常强，但它适合不可信插件生态；对当前仓库内 trusted tool 来说过重。

因此，本次设计不是引入重量级沙箱，而是先建立一条**Host–Tool Boundary Charter**：先把公共边界做稳，再为后续 isolation tiers 预留扩展位。

## Goals / Non-Goals

**Goals:**
- 明确 framework owns 与 tool owns 的职责边界。
- 让 tool 只依赖 public SDK 和声明过的 capability / extension points。
- 把 boundary 规则落实为脚手架和 contract validation 的自动化约束。
- 为未来 optional sandbox 预留分级策略，但不强推当前实现。

**Non-Goals:**
- 不把当前仓库改造成第三方插件市场或远程安装平台。
- 不要求 tool 进入 iframe / worker / 子进程强沙箱。
- 不限制 tool 的内部组件拆分、状态管理、代码风格和渲染实现。
- 不在本次中统一所有 capability 的具体 API 细节；该工作由后续 SDK / lifecycle / IO / recipe changes 承接。

## Decisions

### 决策 1：把“互不影响”定义为边界稳定性，而不是内部代码限制

这条规范的核心不是 tool 代码质量，也不是 tool 内部架构一致性，而是：
- tool 只能依赖 public boundary
- framework internal 不构成 tool contract
- framework 与 tool 之间只通过 capability / extension point 协作

这样能保留插件式结构的开放性，同时真正实现“互不影响”。

### 决策 2：采用 Backstage 式 stable API + extension points，作为主模式

对当前仓库来说，最适合的主模式不是 Figma 式重沙箱，而是 Backstage 式：
- 明确 stable API surface
- capability / extension points 为唯一扩展面
- internal implementation 可以持续重构

这种模式与当前正在推进的 `stabilize-tool-sdk-surface`、`rationalize-tool-io-surface` 和 `unify-tool-host-lifecycle` 完全对齐。

### 决策 3：借鉴 VS Code，把 public / internal 断面写成显式 contract

VS Code 的经验说明，插件系统要长期稳定，必须非常明确什么是 public API，什么不是。对当前仓库，这意味着：
- 文档、脚手架和示例只能演示 public surface
- internal runtime / shell / controller 模块默认不被 tool 直接依赖
- contract validation 需要能发现 boundary 违规 import

### 决策 4：借鉴 Grafana，隔离采用分级策略而非一步到位

当前仓库适合先定义三层心智模型：
- **Level 0 / trusted in-repo tool**：默认层，API 隔离，不做强沙箱
- **Level 1 / optional constrained tool**：可选 worker / iframe / capability allowlist
- **Level 2 / future untrusted plugin**：真正的 sandbox + message bridge

本次只把分级写进规范，不实现 Level 1/2 的运行时。

### 决策 5：boundary 规则必须可自动化执行

如果 boundary 只存在于文档，很快会失效。因此本次设计要求：
- 脚手架默认生成 public imports
- contract validation 检查 tool 是否越过 public boundary
- public API 变更必须附带 deprecation / migration path

## Risks / Trade-offs

- **[Risk] 规则只停留在文档层，无法真正阻止 boundary 漂移** → Mitigation：把规则落进脚手架和 validator。
- **[Risk] public surface 定义过早、过厚，冻结太多内部实现** → Mitigation：只公开 tool 确实需要的 SDK / capability 入口，不暴露 internal controller 细节。
- **[Risk] 提前讨论 isolation tiers 让当前工作分散** → Mitigation：只把分级作为规范预留，不在本次实现 worker / iframe sandbox。
- **[Risk] 与正在推进的四个优化 change 重复** → Mitigation：把本 change 作为总规范，四个 change 作为分项落地，不在本 change 里重复定义具体 capability API。

## Migration Plan

1. 先落地 Host–Tool Boundary Charter。
2. 更新脚手架与 contract validation，使其执行 boundary 规则。
3. 让 `stabilize-tool-sdk-surface`、`add-tool-capability-recipes`、`unify-tool-host-lifecycle`、`rationalize-tool-io-surface` 作为后续分项实现。
4. 在这些 change 完成后，再评估是否需要引入 optional sandbox tier。

## Open Questions

- boundary 校验是只覆盖 import 路径，还是也覆盖某些被标记为 internal 的 symbol 使用。
- Level 1 optional sandbox 将来更适合 worker 还是 iframe。
