# Deshelf Desktop WebContents + MessagePort Tool Container adapter

> 状态：随 Linear MAB-68 落地。对应实现位于 `apps/desktop/`，与 Web adapter（`src/lib/forge/`，见 [web-iframe-adapter.md](web-iframe-adapter.md)）共享同一套 Tool Manifest、Catalog Entry、Environment API、Host Session 与 conformance tests。

## 1. 职责与边界

| Concern | Deshelf Web | Deshelf Desktop |
|---|---|---|
| Tool Source | 构建扫描约定目录 | Open Project（用户选择目录） |
| Catalog | 静态生成（`static/deshelf/`） | Project build 成功后写入 AppData cache |
| Container | same-origin iframe | 独立 WebContents（sandbox） |
| Transport | iframe postMessage adapter | MessagePort adapter |
| Tool code | 预编译 | 受控 Builder 编译（隔离子进程） |
| Asset/Export | browser adapter（blob URL） | Desktop adapter（字节留在 Main，容器只见 opaque URL） |

Desktop Main 进程拥有：Open Project 身份、Forge 构建（cache/发布/Catalog 持久化）、Tool Container realm 生命周期、`deshelf-cache://` 协议、Asset/Export 对话框与磁盘写入。Host UI renderer 拥有 ToolSession、Parameter Store 与 Standard Inspector。Tool Container renderer 只拥有 Canvas/Slate 与热路径。

## 2. 目录结构

```text
apps/desktop/
├─ src/
│  ├─ shared/bridge-protocol.ts   # Host↔Main 唯一 IPC 面（固定 channel + 类型）
│  ├─ transport/port-transport.ts # EnvironmentTransport 的 MessagePort 实现（两端共用）
│  ├─ container/bootstrap.ts      # 容器页 bootstrap（收 port → boot → mount Canvas/Slate）
│  ├─ host/desktop-tool-controller.ts  # Host UI 侧 Session 控制器
│  ├─ main/
│  │  ├─ project-location.ts      # Open Project 身份（projectId + projectLocationId）
│  │  ├─ paths.ts / build-cache.ts     # AppData cache 布局与内容寻址
│  │  ├─ forge-resources.ts       # 可部署 Forge Profile resources 解析
│  │  ├─ controlled-build.ts / controlled-build-runner.ts  # 受控 Builder 子进程
│  │  ├─ build-supplies.ts        # 容器页 + Framework Library import map
│  │  ├─ builder-service.ts       # 构建 → 发布 → Catalog upsert → .deshelf 生成
│  │  ├─ catalog-service.ts       # Desktop Project Catalog 持久化（按 Location 分文件）
│  │  ├─ declarations.ts          # .deshelf/ IDE declarations + .gitignore 维护
│  │  ├─ realms.ts                # WebContents + MessagePort realm 生命周期
│  │  ├─ asset-store.ts / export-writer.ts  # Asset Input / Visual Output adapters
│  │  ├─ resource-protocol.ts     # deshelf-cache:// 协议（路径不进 renderer）
│  │  ├─ desktop-app.ts           # 桥接 handler（无 Electron 依赖，可测）
│  │  └─ electron-main.ts / preload-host.ts / preload-container.ts  # Electron 薄壳
│  └─ ui/                         # Host chrome（vanilla DOM，Standard Inspector 渲染）
├─ tests/                         # bun tests（含共享 conformance suite 的 Desktop 运行）
└─ ui/index.html
```

## 3. Open Project 与多 Location 身份

- `projectId` 是 Manifest 中的不可变逻辑身份；复制目录不改变它。
- `projectLocationId = loc-<sha256(realpath)[0..16]>`：同一路径重复 Open 得到相同 id（cache/Catalog key 稳定）；同一 Project ID 从两个位置打开得到两个独立 Location。
- Catalog 主键是 `catalogEntryId = catalogEntryId({ kind: 'desktop', projectLocationId }, projectId)`，因此多 Location 的同 Project ID 并存且互不覆盖；Reload 只 upsert 自己 Location 的 entry（`DesktopCatalogService` 会拒绝 tagged 给其他 Location 的 entry）。

## 4. AppData cache 与受控 Builder

```text
<userData>/deshelf-forge/
├─ catalogs/<projectLocationId>.json   # 每 Location 一份 Catalog（原子写）
├─ catalogs/index.json                 # Location 索引 + 当前 build 指针
├─ builds/<projectLocationId>/<sourceHash>/   # 不可变构建产物（artifacts/libs/container.html/catalog.json）
└─ tmp/                                # staging，发布后 rename，失败即删
```

- 构建键是对 Tool Project 源文件（manifest/index/canvas/slate 等按相对路径排序后哈希）的内容寻址；未变更的工程直接命中 cache，不重编译。
- 构建在**隔离子进程**中执行（`ControlledBuildExecutor`）：hard timeout，超时 kill，结果经 result file 回传；Electron 下子进程以 `ELECTRON_RUN_AS_NODE=1` 运行。开发态可用 `InProcessBuildExecutor`。
- **可部署 Forge Profile**：部署形态通过 `forge/forge-resources.json` 指向随应用发行的**已编译** worker resources（`createDeployedForgeProfileResolver`）；开发态由 workspace packages 解析（`createDevForgeProfileResolver`）。运行期不依赖 monorepo source paths（`build-supplies.ts` 在打包时与主进程 bundle 一起编译）。
- 构建产物还包括容器供给：Framework Library import map bundles（共享 chunks，单一 runtime 实例）、Desktop 容器 bootstrap bundle、`container.html`。

## 5. `.deshelf/` IDE declarations

构建成功后写回 Tool Project 的**唯一**内容：

- `.deshelf/schema.json` —— 全部 descriptor maps（parameters/assets/commands/privateCallbacks/outputs/inspectorTree）。
- `.deshelf/parameters.d.ts` —— `DeshelfParameters` 等生成类型（select 生成字面量联合，computed 标注 mode）。
- `.gitignore` —— 幂等追加 `.deshelf/`（已忽略则不改动）。

生成是确定性的：相同 descriptor 产生字节相同的文件；内容未变时不重写。

## 6. WebContents + MessagePort transport

- 每 Session（每 endpoint）一个 realm：`webContents.create` + `MessageChannelMain`。
- Main 只做**一次性 handoff**：`port1` 经 `webContents.postMessage('deshelf:port', payload, [port1])` 转移进容器 realm，`port2` 转移进 Host UI renderer。此后全部 Environment 流量在两个 renderer 之间走 MessagePort，**Main 不做逐消息转发**（无 per-message invoke）。
- Container realm webPreferences 强制 `sandbox: true, contextIsolation: true, nodeIntegration: false`；容器 preload 只暴露 `DeshelfContainer.onPort`（接收转移的 port），没有 Node、没有任意 ipcRenderer、没有 invoke 通道。Host renderer preload 同样只逐个暴露固定 bridge 函数。
- Restart：controller 先 open 新 realm 并 adopt transport，`session.restart({ sessionId: <Main 签发的 id> })`（tool-host 的 `BootOptions.sessionId` 允许 Desktop 钉住 Main 签发的 id），随后 Main `closeSession(old)` 销毁旧 realm。Realm manager 按 sessionId 跟踪全部 WebContents/ports：close 幂等、外部 destroy 上报并 forget，不泄漏 WebContents 或 MessagePort。
- Slate：Main Ready 后按需打开第二个 realm，不阻塞 Canvas Ready。

## 7. `deshelf-cache://` 协议

- standard + secure + supportFetchAPI + stream，在 `app.ready` 前注册。
- 只有 `deshelf-cache://builds/<locId>/<hash>/<path>` 一个文件命名空间；解析是唯一 URL → 路径映射点，拒绝 `..`/反斜杠/空段/未知 host，并做 cache-root 前缀二次校验。
- `deshelf-cache://session-assets/<handle>` 由 `SessionAssetStore` 提供（内存字节，不在文件系统布局内）。

## 8. Asset Input 与 Visual Output（路径不进 Tool Container）

- **Asset Input**：文件对话框在 Main；字节一次读入 Main 的 session-scoped 内存（session 关闭即释放）。容器拿到的 AssetContent 是 `{ kind: 'blob-url', url: 'deshelf-cache://session-assets/<handle>', mime }` —— opaque URL，容器可 fetch，但永远见不到真实文件路径，字节也不在 envelope 里传输。
- **Visual Output**：容器内 render，`export.result` 仍是可序列化内容。若内容是容器 realm 的 `blob:` URL，Main 通过容器 realm 自身 `executeJavaScript(fetch → FileReader.readAsDataURL)` 在容器 origin 内解析成 data URL，再弹 save dialog 写盘。真实路径只存在于 Main 进程。

## 9. Conformance 与测试

- `apps/desktop/tests/conformance-desktop.test.ts`：用与 Web adapter 相同的共享 suite（`tool-host/conformance`），以 `FakeMessageChannelMain` + 真实 `createPortTransport` 两端跑通全部 Environment API 语义（boot/ready、computed wave、Slate 时序、command 超时、stale session 丢弃、asset、export、resize、close dispose）。
- 其余测试覆盖：Location 身份与多 Location 隔离、Catalog 持久化（损坏 entry 跳过、外部 entry 拒绝）、`.deshelf` 幂等、realm 生命周期与泄漏、cache URL 遍历防护、Asset/Export adapter、以及真实 tool-builder 流水线的 build/cache/失败集成测试。

## 10. 开发与部署

```bash
bun install
bun run --cwd apps/desktop app:dev   # electron .（需要本地可用的 Electron 二进制）
bun test                             # 全部测试（含 Desktop conformance）
```

> 本仓库默认不下载 Electron 二进制；首次运行 `app:dev` 前请执行 `bun pm trust electron`（或用 npm 安装）以获取 dist。

打包发布时（packaging step）：

1. 用 esbuild/bundle 将 `apps/desktop/src/main/*` 编译为 CJS/ESM JS；`build-supplies.ts` 与容器 bootstrap 一并编译，运行期不引用仓库源码路径；
2. 编译 extraction worker（`packages/tool-builder/src/worker/extraction-runner.ts`）与 tool-sdk/tool-contract 入口为 JS，放入 `resources/forge/compiled/`，写 `forge-resources.json`；
3. 打包 `apps/desktop` 的 preload/main/ui 与 `forge/` 资源目录。
