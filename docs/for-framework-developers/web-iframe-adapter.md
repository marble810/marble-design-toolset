# Web same-origin iframe adapter

> 状态：已实现（MAB-69）。本文描述 Deshelf Web 端 Tool Container adapter 的实现：静态 Catalog 生成、same-origin iframe 容器、Environment API transport 与 Host chrome。

## 概览

Deshelf Web 在**应用构建期**扫描 bundled Tool Projects，调用共享的 `tool-builder` 生成静态 Catalog 与预编译 artifacts。运行期 Host 仅凭 Catalog Entry 建立 Parameter Store 与 Standard Inspector，并通过 same-origin iframe adapter 启动 Main/Slate Tool Containers。

```text
scripts/build-web-catalog.ts   构建期入口：扫描 → 构建 → 供给 → 原子发布
src/lib/forge/iframe/          EnvironmentTransport adapters（Host 端 / Container 端）
src/lib/forge/container/       容器内 bootstrap（生成的 container.html 的入口脚本）
src/lib/forge/web/             StaticCatalogSource + WebToolController（Host 侧编排）
src/lib/forge/components/      ForgeToolHost / ForgeInspector（demo Host chrome）
static/deshelf/                生成产物（gitignore，不入库）
tools/                         bundled Tool Project 约定目录
```

## 构建期：静态 Catalog 生成

入口为 `bun ./scripts/build-web-catalog.ts`（`bun dev` / `bun build` 会自动执行），核心流程在 `scripts/web-catalog/generate.ts`：

1. **扫描**（`scan.ts`）：遍历约定目录 `tools/` 的第一层子目录。只有 `manifest.json` 带 Deshelf identity 字段（`contractVersion` / `projectId` / `forgeProfile`）的目录才是 candidate；无关目录（含旧架构 legacy tools）静默忽略，"像 Deshelf 但校验失败" 的 manifest 产生 diagnostic。slug 与 projectId 重复时后者按确定性顺序失败。
2. **构建**：每个 candidate 调用共享 `tool-builder` 的 `buildToolProject`（编译 Tool Entry + Canvas/Slate、受控 extraction、Catalog upsert）。**失败的条目不进入可用 Catalog**，只以 failures + diagnostics 上报。
3. **Framework Libraries 供给**（`lib-bundles.ts`）：扫描构建产物的 bare import（`svelte`、`svelte/*`、声明的三方库），用一个 Vite library 构建为每个 specifier 生成 re-export 入口文件，共享 internals 落入 shared chunks——保证例如 `svelte` 与 `svelte/internal/client` 共享同一 runtime 实例。容器页通过 **import map** 供给这些库；Tool 永不自带拷贝。
4. **容器页**：生成 `container.html`（内联 import map + 工具样式表链接 + bootstrap bundle 引用）与 `container-bootstrap.js`。
5. **原子发布**：全部产物先写入 staging，再以单次 `rename` 发布为不可变 `releases/<id>/`；最后原子替换 `catalog.json`，使读者只会看到指向完整 release 的旧或新 Catalog。旧 release 保留 24 小时供已读取旧 Catalog 的页面继续启动或 Restart，超过安全期后由后续构建清理。生成器不会删除其他进程的 staging。

`catalog.json` 结构：`{ version, source: {kind:'web', sourceId}, entries: CatalogEntry[] }`，entries 即共享 `tool-contract` 的 Catalog Entry（artifact 引用为相对路径，运行期相对 catalog URL 解析）。

## 运行期：same-origin iframe 容器

### Transport adapters

两端实现同一个 `EnvironmentTransport` seam（`tool-contract`）：

- **Host 端**（`iframe/host-transport.ts`）：发送经 `iframe.contentWindow.postMessage(msg, origin)`；在容器文档 `load` 之前出站消息排队（`src` 在插入 DOM 前设置，因此只有一次 load 事件）。入站仅接受 `event.source === iframe.contentWindow` 且 `event.origin` 为共享 origin 的消息——多个 Tool iframe / 多标签页互不串扰。
- **Container 端**（`iframe/container-transport.ts`）：发送到 `window.parent`；入站仅接受来自 parent 窗口、同 origin 的消息。

source/origin 过滤是会话卫生，**不是安全边界**。

### 容器内 runtime

`packages/tool-sdk` 的 `startToolContainer`（`src/container/runtime.ts`）是 Web/Desktop 共用的容器 runtime：

- 等待唯一的 `boot` request（无 hello/welcome/registration 阶段），校验 endpoint role；
- 通过注入的 `loadDefinition` 动态 import artifact URL，注入的 `mountSurface` 挂载 Canvas/Slate，然后发出 `surface.ready`；
- 本地镜像 Parameter/Asset/Surface 状态并订阅更新；应答 `parameter.compute`、执行 `command.execute/cancel`、`export.execute`（render 结果归一化为 blob URL 等 `ExportContent`）、响应 `asset.request`；
- definition-dependent 消息（command/compute/export）在 artifact 加载完成前**按到达顺序排队**——Host 会在 boot 后立即重试 HostReady 期间延迟的 compute wave；
- `surface.dispose` 或 `close()` 触发 unmount + 客户端销毁。

Web 侧入口 `src/lib/forge/container/bootstrap-main.ts` 解析 `?entry=<artifact url>&endpoint=main|slate`，从 import map 动态加载 `svelte` 的 `mount/unmount`，并以 `{ context }` props 挂载 Canvas/Svelte 组件。`ContainerSurfaceContext`（tool-sdk）暴露 parameter/asset/surface 镜像、`setParameter`、`requestAsset` 与 `client`。

### Host 侧编排

`src/lib/forge/web/web-tool-controller.ts` 的 `WebToolController`：

- 创建 Main iframe 并 `session.boot`（附 Environment Inventory：assets/exports 能力清单）；
- **Main Ready 之后**才创建可选 Slate iframe 并 `session.bootSlate`——Slate 永不阻塞 Canvas 首帧；
- ResizeObserver → `session.resizeSurface(role, size)`（每 Surface 独立转发）；
- `restart()`：先创建替换容器再 `session.restart`（旧容器收到 best-effort `surface.dispose`），旧 iframe 移除；
- `setAssetFromFile`（File → blob URL → `session.setAsset`）与 `exportOutput`（`export.execute` → `export.result` content）两个浏览器 adapter；
- `close()` 收尾 Session 与 DOM。

**容器 iframe 有意不设置 `sandbox` 属性**：sandbox 会产生 opaque unique origin，破坏同源 artifacts 与 Framework Libraries 供给；也不存在 Capability Grant——Environment API 只承载管理面。

`StaticCatalogSource`（`web/static-catalog-source.ts`）负责 fetch + 逐条 `validateCatalogEntry` 校验 + artifact URL 解析。

## 共享 conformance tests

`tool-host/conformance` 导出 `runEnvironmentConformanceTests(harness)`：以真实 `ToolSession`（Host 侧）对打真实 `startToolContainer`（容器侧），覆盖 boot→ready、staged catch-up snapshot、computed wave、Slate 时序与 endpoint mismatch、parameter.set 接受/拒绝、command lifecycle（含 timeout → Unresponsive → Restart）、stale sessionId 与非法 envelope 丢弃、asset/export 流、surface.resize、close dispose 十组场景。

- `packages/tool-host/tests/conformance.test.ts`：in-memory transport；
- `src/lib/forge/web/conformance-web.test.ts`：**Web iframe transport pair**（fake 同源窗口、浏览器式异步投递 + 真实 iframe transport + 真实容器 runtime）。

Desktop（MAB-68）将以 MessagePort transport pair 复用同一套 harness。

## 浏览器 smoke test

`bun run build` 后执行 `bun ./scripts/smoke-web-adapter.mjs`：以 headless Chrome/Edge 加载生产构建，打开 Catalog 条目，断言 Session Ready、Canvas 挂载于 iframe 内且 rAF 标记实际推进、Inspector slider 参数经 Host Store 同步到 Slate 镜像、Restart 后回到 Ready、无 console 错误。

## 风险声明：同 renderer，无 failure isolation

same-origin iframe 与 Host 共享同一个 renderer process。**Tool 内的死循环（如失控的 rAF/while）会卡死整个页面**；Host chrome 提供 Restart Tool，但 Web 端不承诺 process 级或 failure 级隔离。这是性能优先的产品取舍：预编译 Tool 来自构建期 Catalog，不存在运行时加载不可信第三方内容的场景，因此不引入 unique origin/Capability Grant/消息 ACL 等对抗机制。

## Demo 路由

根路由 `/`（`src/routes/+page.svelte`）是 Catalog-driven Tool Host：列出静态 Catalog、打开 Tool、渲染 Standard Inspector（rAF 合并 pointer 输入）、Asset 输入与 Export 按钮、Restart / staged Reload / Reset Defaults 控件与诊断横幅。该页面仅做 client 渲染（`ssr = false`）。
