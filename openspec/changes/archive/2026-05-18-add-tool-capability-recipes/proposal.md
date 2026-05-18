## Why

当前 `create:tool` 只能生成基础骨架，但仓库里的 tool 已经开始重复手拼几类固定组合：基础 PreviewCanvas、source input + drop、Pixi/Three render host、导出工具等。继续依赖作者手工拼装这些常见 wiring，会让 tool 开发体验越来越啰嗦，也会放大样板差异。

## What Changes

- 在现有脚手架之上引入 capability recipes，覆盖一组常见的 tool 起步形态，而不是只提供单一空白 starter。
- 让脚手架支持按 recipe 生成更完整的 wiring，包括 source input、drop zone、render host、export 等常见能力组合。
- 明确 recipe 是可选加速器而不是强约束，tool 仍然可以跳出 recipe 自定义内部实现。
- 同步更新 tool authoring 文档，使“选择哪个 recipe 起步”成为比“先读一堆 runtime 细节”更短的入口路径。

## Capabilities

### New Capabilities
- `tool-capability-recipes`: 定义脚手架为常见 tool 能力组合提供的 recipe 类型、产出形状和适用边界。

### Modified Capabilities
- `tool-scaffolding`: 扩展脚手架行为，使其能够根据 recipe 生成不同的 tool 起步结构和 wiring。

## Impact

- `scripts/create-tool.js`
- `scripts/tool-scaffold/`
- `src/tools/hello-world/`
- `docs/guides/Making Tools/`
- `openspec/specs/tool-scaffolding/spec.md`
