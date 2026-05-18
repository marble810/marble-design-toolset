# 脚手架与 Recipes

## 脚手架入口

```bash
bun run create:tool
# 等价于
node scripts/create-tool.js
```

脚手架收集 tool name 和 capability recipe，生成符合 contract 的 `src/tools/<tool-id>/` 目录。

## 目录结构

```
scripts/
├── create-tool.js              ← CLI 入口（交互式提问）
├── tool-contract/
│   ├── validate.mjs            ← Tool schema + boundary import validation
│   └── validate.test.mjs
└── tool-scaffold/
    ├── index.js                ← Recipe 选择 + 选项收集逻辑
    ├── scaffold.test.mjs       ← 脚手架集成测试
    └── templates/
        └── index.js            ← 各 recipe 的代码模板
```

## Recipe 列表

| Recipe | 描述 |
|---|---|
| `preview-basic` | `LeftPanel` + `RightPanel` + `PreviewCanvas`；纯 DOM/SVG/Canvas 起步 |
| `source-preview` | `createToolSourceInput` + `SourceInputSection` + `DropZone` + 预览占位 |
| `pixi-preview` | `techStack: ['pixi']`、`createRenderHostLifecycle()` + `createPixiApplicationHost()` |
| `three-stage` | `techStack: ['three']`、`FullStage`、`createThreeRenderHost()` + animation loop |
| `preview-export` | `metadata.json export` 声明 + `createCanvas2DRenderHost()` + exporter 注册 |
| `layout-template` | `createLayoutToolController()`、多 source slots、Google Fonts / uploaded font、DOM 导出接线 |
| `custom` | 手动选择 preview/stage 和 tech stack 的空白 starter |

## 添加新 Recipe

1. 在 `scripts/tool-scaffold/index.js` 的 recipe 列表中添加新选项：
   ```js
   { value: 'my-recipe', label: 'My Recipe', hint: '适用场景说明' }
   ```

2. 在 `scripts/tool-scaffold/templates/index.js` 中实现模板生成函数：
   ```js
   function generateMyRecipe({ toolId, componentName, pascalName }) {
     return {
       'metadata.json': JSON.stringify({ /* ... */ }, null, 2),
       'index.ts': `import metadata from './metadata.json';\n// ...`,
       [`${pascalName}.svelte`]: `<script lang="ts">\n// ...`,
       'components/MyCanvas.svelte': `<script lang="ts">\n// ...`
     };
   }
   ```

3. 在 `index.js` 的 `generateToolFiles()` 中处理新 recipe case。

**模板约定：**
- 模板必须使用 public SDK imports（`$lib/tool-sdk/index.js`、`$lib/components/shell/index.js`、`$lib/components/ui/index.js`），不使用 internal 路径。
- 模板生成的 tool 必须能通过 contract validation。
- 只生成最小可运行的 wiring，不内联过多业务示例。

## Contract Validation

`scripts/tool-contract/validate.mjs` 验证：

1. **Schema validation**：每个 `src/tools/<id>/` 必须有 `metadata.json`、`index.ts`、恰好一个 root-level `.svelte`。
2. **Boundary validation**：工具代码不能直接 import `DISALLOWED_TOOL_IMPORTS` 中的 internal 路径。

脚手架测试（`scaffold.test.mjs`）验证每个 recipe 生成的代码都能通过 contract validation：

```bash
npm run test   # 包含 scaffold 测试
```

### 更新 DISALLOWED_TOOL_IMPORTS

当某个 internal 路径不应被 tool 访问时，在 `validate.mjs` 的 `DISALLOWED_TOOL_IMPORTS` 中添加：

```js
const DISALLOWED_TOOL_IMPORTS = [
  '$lib/runtime/canvas-export/context',
  // 新增路径...
];
```

同时更新 `ALLOWED_LEGACY_IMPORTS` 处理已有的历史兼容路径（注意不要把需要逐步迁移的路径也加入 disallowed）。

## 运行脚手架测试

```bash
npm run test
# 或者只运行 scaffold 相关
node --test scripts/tool-scaffold/scaffold.test.mjs
node --test scripts/tool-contract/validate.test.mjs
```
