## 1. Contract 与 Catalog（MAB-67）

- [x] 1.1 定义 Tool Manifest、CatalogSourceRef、CatalogEntry、Parameter/Asset/Output 与 Inspector descriptor schemas。
- [x] 1.2 确定 Inspector private callback 使用 Tool Entry named map；Catalog 保存 ID，函数留在 Main artifact。
- [x] 1.3 实现受控 extraction process、timeout、deterministic fixtures 与 diagnostics。
- [x] 1.4 生成 Main/Slate artifacts，并提供 Web/Desktop Catalog Source 可复用的 Builder 与 Catalog Store interfaces。

## 2. Host Session 与 Environment API（MAB-66）

- [x] 2.1 定义 Environment API discriminated unions、runtime schemas 与 test vectors。
- [x] 2.2 实现 Cataloged/HostReady/Booting/Ready/Failed/Closed lifecycle core。
- [x] 2.3 实现 Host-owned Parameter Store、Constraint、revision、coalescing 与 computed scheduling。
- [x] 2.4 实现 retained Standard Inspector renderer 与 Tool Command lifecycle（headless view-model renderer core + default tree；DOM 渲染绑定随 Web/Desktop adapters）。
- [x] 2.5 实现 staged Reload、Restart、Reset 与单 replacement invariant。

## 3. Web adapter（MAB-69）

- [ ] 3.1 构建期扫描 bundled Tool Projects，调用共享 Builder 并原子生成 Web static Catalog。
- [ ] 3.2 实现 same-origin Main iframe Tool Container 与 boot/ready。
- [ ] 3.3 实现可选 Slate iframe，确保不阻塞 Canvas Ready。
- [ ] 3.4 供给 Forge libraries、Asset/Export adapters 与 Host diagnostics。
- [ ] 3.5 通过共享 Environment API conformance tests。

## 4. Desktop adapter（MAB-68）

- [ ] 4.1 建立 Electron Main/Preload/Renderer 与 Open Project workflow。
- [ ] 4.2 实现受控 Builder process、可部署 Forge Profile/worker resources 与 AppData cache。
- [ ] 4.3 实现 Desktop Project Catalog 持久化/upsert、同 Project ID 多 Location，并生成 `.deshelf/` IDE declarations/schema。
- [ ] 4.4 实现 Main/Slate WebContents + MessagePort transport。
- [ ] 4.5 实现不暴露真实路径的 Asset/Export adapters。
- [ ] 4.6 通过与 Web 相同的 conformance tests。

## 5. Shallow Water migration（MAB-70）

- [ ] 5.1 迁移为 `manifest.json + index.ts + canvas/` Tool Project。
- [ ] 5.2 把 Parameter、computed、Constraint、Command 与 Inspector Tree 接入 Host contract。
- [ ] 5.3 保留 simulation/renderer 热路径与 Visual Output 行为。
- [ ] 5.4 接入 Asset Input、Export、dispose、Reload/Restart/Reset。
- [ ] 5.5 删除 Tool-owned panels、Parameter Store、`$lib` imports 与其他旧 Visual Tools。

## 6. 清理与文档

- [ ] 6.1 删除旧 `tool-registry.ts`、runtime Registration 和同 realm Tool contexts。
- [ ] 6.2 更新 Tool scaffold 与 Tool author 指南。
- [ ] 6.3 更新或归档被本 change 取代的 specs 与 framework docs。
- [ ] 6.4 运行 contract、unit、conformance、Web/Desktop smoke tests 与 production builds。
