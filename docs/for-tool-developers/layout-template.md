# Layout Template 工具指南

`layout-template` 面向“template as a tool”的平面版式工具。每个模板仍是独立 tool，继续使用 Svelte 组件和 CSS 写预览 DOM；framework 只提供 headless controller 来统一尺寸、素材输入、字体和导出。

## 何时使用

适合这些场景：

- 海报、社媒图、封面、卡片等固定或可变画布尺寸的 DOM 版式。
- 需要多个命名素材输入，例如 Hero Image、Logo Image、Uploaded Font。
- 需要 Google Fonts 或用户上传字体。
- 需要走 framework Export panel 导出 PNG，而不是 tool 自己下载。

不适合第一版范围：

- 自由拖拽编辑器。
- PDF / SVG 导出。
- 图像裁剪、图层面板或模板 DSL。

## 脚手架

```bash
bun run create:tool
```

选择 `layout-template` recipe。生成的 tool 会包含：

- `metadata.json` 的 image export 声明。
- `index.ts` 的懒加载组件定义，不声明 heavy tech stack。
- 一个 root-level master `.svelte`。
- 一个私有 layout preview 子组件。
- `createLayoutToolController` 的完整接线示例。

## Controller 结构

入口从公共 SDK 导入：

```ts
import { createLayoutToolController } from '$lib/tool-sdk/index.js';
```

配置按四块分区：

```ts
const layout = createLayoutToolController({
	size: {
		defaultWidth: 1080,
		defaultHeight: 1080,
		minWidth: 320,
		maxWidth: 4096,
		minHeight: 320,
		maxHeight: 4096
	},
	sources: {
		slots: [
			{
				id: 'hero',
				name: 'Hero Image',
				desc: 'Primary image used by the template.',
				allowedKinds: ['image'],
				required: false,
				maxSizeMB: 12
			},
			{
				id: 'font',
				name: 'Uploaded Font',
				desc: 'Optional custom font file.',
				allowedKinds: ['font'],
				required: false,
				maxSizeMB: 8
			}
		]
	},
	fonts: {
		defaultFamily: 'system-ui, sans-serif',
		systemFallback: 'system-ui, sans-serif',
		googleWeights: [400, 700]
	},
	export: {
		id: 'layout-template',
		label: 'Layout',
		getElement: () => layoutRoot,
		domOptions: {
			backgroundColor: '#111827',
			filter: (node) => !(node instanceof Element) || !node.hasAttribute('data-export-hidden')
		}
	}
});
```

## 尺寸

`layout.size` 管理用户输入字符串和导出用的安全数值：

- `widthInput` / `heightInput`：用于绑定输入框。
- `contentWidth` / `contentHeight`：已按 min / max 约束后的像素尺寸。
- `setWidthInput()` / `setHeightInput()`：更新输入。
- `diagnostics`：越界或非法输入 warning。

`PreviewCanvas` 应使用 `contentWidth` / `contentHeight`：

```svelte
<PreviewCanvas contentWidth={layout.size.contentWidth} contentHeight={layout.size.contentHeight}>
	<LayoutPreview bind:rootElement={layoutRoot} />
</PreviewCanvas>
```

## Source slots

`layout.sources` 是多 slot source workflow，可以直接传给共享 UI：

```svelte
<SourceInputSection source={layout.sources} title="Sources" />
```

如果要把 drop 绑定到某个 slot：

```svelte
<DropZone source={layout.sources} slotId="hero" ariaLabel="Hero image drop zone">
	<!-- preview -->
</DropZone>
```

读取素材：

```ts
const hero = $derived(layout.sources.getSlot('hero')?.currentItem);
```

## 字体

Google Fonts：

```ts
await layout.fonts.loadGoogleFont('Inter');
```

也可以直接解析 Google Fonts 链接：

```ts
const parsed = await layout.fonts.loadGoogleFontFromUrl(
	'https://fonts.google.com/specimen/Space+Grotesk'
);

if (parsed) {
	console.log(parsed.family); // Space Grotesk
}
```

如果只是想给“打开 Google Fonts”按钮生成跳转地址：

```ts
const browseUrl = layout.fonts.getGoogleFontsBrowseUrl('Inter');
```

用户上传字体：

```ts
await layout.fonts.useUploadedFont('font');
```

预览 DOM 使用：

```svelte
<div style={`font-family:${layout.fonts.family};`}>
	...
</div>
```

如果 Google Font 加载失败，controller 会回退到 system fallback，并在 `layout.diagnostics` 和 Export panel warning 中暴露原因。

推荐的交互顺序：

- 手动输入 family 名称并点击 `Load Google Font`
- 或者直接粘贴 Google Fonts 页面 / CSS2 URL，点击 `Parse Google Fonts URL`
- 需要查找字体时，提供一个 `Open Google Fonts` 按钮
- Google Fonts 不满足时，再允许用户上传字体文件

关于“读取本地系统字体文件夹”：当前标准浏览器环境不能直接访问用户系统字体目录。现阶段建议继续采用“Google Fonts + 上传字体”主路径；如果未来需要做备选增强，可单独评估 Chromium 的 Local Font Access API，并以显式权限和浏览器能力检测为前提。

## DOM 导出

layout controller 会注册 `kind: 'dom'` exporter。tool 只需要提供 `getElement` 和尺寸；PNG 导出仍由 framework Export panel 管理，支持 1x / 2x / 4x。

可用的安全导出选项：

- `backgroundColor`
- `filter`
- `cacheBust`
- `style`

不要在 tool 内直接调用 `html-to-image`、`toDataURL()` 或手写下载链接。
