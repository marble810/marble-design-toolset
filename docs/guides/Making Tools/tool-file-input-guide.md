# Tool File Input Guide

## 适用范围

当 tool 需要把本地文件作为数据来源时，优先使用 framework 提供的 tool IO facade，而不是每个工具自己拼装 `input type=file`、`FileReader`、拖放解析、Source section 和对象 URL 清理逻辑。

当前统一管道覆盖三类输入：

- 图像
- 影片
- 文字

首版能力只承诺单次维护一个当前输入结果，不负责多文件编排、目录导入、剪贴板粘贴或远程 URL 抓取。

## 推荐入口模块

tool 作者优先从两个稳定入口组合文件来源：

- `src/lib/runtime/io/`：`createToolSourceInput`、文件摘要和下载 primitive
- `src/lib/components/tool-io/`：`SourceInputSection` 与 `DropZone`

底层文件输入管道仍位于 `src/lib/runtime/file-input/`，共享类型位于 `src/lib/types/file-input.ts`。只有在需要自定义 UI 或特殊 ingest 流程时，才直接使用底层 controller。

## 推荐模式：Source workflow

最常用的入口是 `createToolSourceInput`。它复用底层 file-input pipeline，同时把 picker、drop、drag-over 状态、错误、摘要和对象 URL 生命周期收敛成一个 workflow 对象：

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { SourceInputSection, DropZone } from '$lib/components/tool-io/index.js';
  import { createToolSourceInput } from '$lib/runtime/io/index.js';

  const sourceInput = createToolSourceInput({ allowedKinds: ['image', 'video'] });
  const sourceItem = $derived(sourceInput.currentItem);

  onDestroy(() => sourceInput.dispose());
</script>

<LeftPanel>
  <SourceInputSection source={sourceInput} />
</LeftPanel>

<RightPanel>
  <DropZone source={sourceInput} ariaLabel="Drop source file">
    <!-- preview content consumes sourceItem -->
  </DropZone>
</RightPanel>
```

workflow 暴露这些状态和动作：

- `accept`：与 `allowedKinds` 一致的 accept 字符串，可复用到隐藏文件输入元素
- `busy`：当前是否正在 ingest / 读取文件
- `currentItem`：最近一次成功导入的标准化结果
- `lastError`：最近一次失败导入的稳定错误对象
- `summary`：用于 Source UI 的文件名、kind、尺寸、时长和大小摘要
- `isDragOver`：DropZone 共享的拖放悬停状态
- `pick()`：打开浏览器文件选择器，并自动走统一 ingest 路径
- `ingestFiles(files, source)`：手动提交 picker 或 drop 得到的文件集合
- `ingestDrop(files)` / `handleDrop(event)`：统一 drop ingest 入口
- `clear()`：清空当前成功结果和错误，并回收 runtime 创建的对象 URL
- `dispose()`：组件卸载时做最终清理

## 标准化结果

成功导入后，控制器会返回 discriminated union 结果：

- 图像：`kind = image`，包含 `objectUrl`、`width`、`height`
- 影片：`kind = video`，包含 `objectUrl`、`width`、`height`、`duration`
- 文字：`kind = text`，包含解码后的 `text`

所有结果都包含共享字段：`source`、`file`、`name`、`mimeType`、`size`、`lastModified`。

## 底层 controller 仍可用

`SourceInputSection` / `DropZone` 覆盖多数工具场景。如果你确实需要完全自定义 UI，可以继续直接使用底层 `createFileInputController`，但仍必须遵守统一的 `accept`、`ingestFiles(...)`、`clear()` 和 `dispose()` 语义。

## picker 与隐藏 input

如果工具只需要一个简单的“Choose File”按钮，可以直接使用 `pick()`：

```ts
async function handlePick() {
  await fileInput.pick();
}
```

如果工具已经有自己的隐藏文件输入元素，也必须继续使用控制器派生的 `accept`，并把选中的文件交给 `ingestFiles(...)`：

```svelte
<input
  bind:this={hiddenInput}
  type="file"
  accept={fileInput.accept}
  on:change={(event) =>
    void fileInput.ingestFiles(event.currentTarget?.files ?? [], 'picker')}
/>
```

关键点只有两个：

- `accept` 来自控制器，不自己硬编码一份
- picker 结果和 drop 结果都走同一个 `ingestFiles(...)`

## 拖放接入

拖放入口不要自己解析 `DataTransferItemList`。统一使用 `extractDroppedFiles(event)` 再交给控制器：

```ts
function handleDrop(event: DragEvent) {
  event.preventDefault();
  void fileInput.ingestFiles(extractDroppedFiles(event), 'drop');
}
```

这样 picker 和 drop 会共享同一套：

- 文件类别判定
- 单文件约束
- 标准化读取
- 错误语义

## 失败与清理语义

控制器有几个重要约束：

1. 失败导入不会清空最近一次成功结果。
2. 只有新的导入成功后，旧媒体结果的对象 URL 才会被回收。
3. `clear()` 和 `dispose()` 都会回收当前媒体结果的对象 URL。
4. 图像 / 影片的对象 URL 生命周期由 runtime 持有，tool 不应再自己调用 `URL.revokeObjectURL(...)`。

这意味着：

- tool 可以始终从 `currentItem` 读取最近一次有效输入
- tool 只需要消费结果，不需要重复维护媒体临时资源

## 推荐使用模式

推荐把控制器创建在 tool 的 master 组件或最靠近输入行为的私有组件里，再把 `currentItem` 传给真正消费数据的子组件。

适合的场景：

- 图像生成 / 编辑 tool 的源图导入
- 视频帧分析或封面抽取的输入视频选择
- 文字驱动工具的脚本文本、配置文本或模板文件读取

不适合的场景：

- 多文件时间轴或批处理导入
- 目录树遍历
- 粘贴板输入
- 远程 URL 下载

这些能力如果以后需要，请通过新的 OpenSpec change 扩展，而不是在单个 tool 内私自分叉。

## 开发约束

- 不在 `metadata.json` 里声明文件输入能力。
- 不在 tool 内自己维护第二套 MIME 过滤规则。
- 不在 tool 内自己管理图像 / 影片对象 URL 的回收。
- 不要因为输入源不同就拆成两套 picker / drop 处理路径。

统一文件输入 runtime 是 framework-owned 的共享能力。工具只负责声明允许的 kind，并消费标准化后的结果。