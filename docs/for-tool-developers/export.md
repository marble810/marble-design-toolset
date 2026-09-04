# Tool 导出指南（Visual Output）

Visual Output 是 Tool 在 Tool Entry `outputs` named map 中声明的导出能力。descriptor（格式、label、尺寸规则）由 Forge 抽进 Catalog，Host 负责 Export UI 与下载编排；实际的 render/encode 回调留在 Main artifact、在 Container 内执行。

> 前置阅读：[create-a-tool.md](./create-a-tool.md) 的 Tool Entry 与 Container 内共享状态两节。

## 声明

```ts
import { defineVisualTool } from '@deshelf/tool-sdk';

export default defineVisualTool({
  outputs: {
    heightMap: {
      kind: 'image',              // 'image' | 'video'
      label: 'Height Map PNG',
      mime: 'image/png',
      async render() {
        // 运行在 Container 内；返回 Blob / ArrayBuffer / blob:/data: URL / typed view
        return buildPngBlob();
      }
    },
    simulationVideo: {
      kind: 'video',
      label: 'Simulation Video',
      mime: 'video/mp4',
      async render() {
        return recordVideoBlob();
      }
    }
  },
  /* … */
});
```

规则：

- 稳定 ID 来自 map key；跨 `parameters`/`assets`/`commands`/`privateCallbacks`/`outputs` 五个 map 全局唯一。
- `render` **必须**在 Tool Entry（或其静态可及的私有模块）中定义；Canvas mount 后再注册 exporter 是被禁止的。
- descriptor 的 `mime` 是意图声明；实际返回 Blob 时以 Blob 自身类型为准（例如 MP4 不可用时回退 WebM，Host 下载扩展名跟随内容）。

## 执行路径

```text
Host Export UI（entry.outputs descriptors）
  → session.executeExport(outputId)
  → export.execute request → Main Container
  → Container runtime 调用 outputs.<id>.render({ surface, parameters, width, height })
  → 返回值规范化为 { kind:'blob-url', mime, url } 或 { kind:'empty' }
  → export.result → Host 下载
```

- 与 Tool Command 共用超时配置（`commandTimeoutMs`，默认 10s）；长编码任务要控制在该预算内（shallow-water 的 90 帧 @30fps 重放约 3s）。
- 编码在 Container 内完成（MediaRecorder / canvas.toBlob 都可用）；Host 只拿到编码后的 Blob，不接触 Tool 内部状态。

## 确定性导出（模拟类 Tool）

预览的 rAF 是墙钟驱动，导出必须与之解耦：在 Container 内创建离屏 renderer，从 frame 0 确定性重放到目标帧数，再用 `canvas.captureStream(0)` + 手动 `requestFrame()` 以固定节奏喂给 MediaRecorder。参考实现：`tools/shallow-water/sim/export-replay.ts`。

```ts
// 伪代码骨架（完整实现见 export-replay.ts）
const canvas = createOffscreenCanvas(sim.resolution);
const renderer = new WaveRenderer(canvas, sim.resolution);
renderer.setInitialHeight(initialData);
const blob = await recordDeterministicFrames(canvas, pickedMime, totalFrames, fps, async (frameIndex) => {
  if (frameIndex > 0) renderer.advanceFrames(1, sim);
  renderer.render(sim);
});
```

- 帧相位只来自整数模拟步数（不读 `performance.now()`），保证预览 reset 与导出重放一致。
- 导出期间预览循环继续运行是允许的（离屏 renderer 与预览 renderer 互不干扰，与旧实现一致）。

## Host 侧行为

- Web Host chrome 按 Catalog 的 output descriptors 渲染 Export 按钮，点击后经 `WebToolController.exportOutput` 执行并触发下载；失败以 diagnostic 呈现。
- Desktop 走 Desktop adapter：容器解析出 Blob 后由 Main 进程写盘确认，真实路径不进入 Tool。
- `Reload/Restart` 后 outputs 以新 Catalog Entry 的 descriptors 为准；descriptor 变化随 staged Reload 迁移。
