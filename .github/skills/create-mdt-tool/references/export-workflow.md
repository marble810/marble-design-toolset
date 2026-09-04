# Export Workflow

Export = Visual Outputs declared in the Tool Entry `outputs` named map. Only add an output when the tool genuinely needs it.

## Declare

```ts
outputs: {
  heightMap: {
    kind: 'image',            // 'image' | 'video'
    label: 'Height Map PNG',
    mime: 'image/png',
    async render() { /* runs in the Main Container */ }
  }
}
```

- Stable ID comes from the map key (unique across all five named maps).
- `render` returns a `Blob`, `ArrayBuffer`, typed view, or `blob:`/`data:` URL; the container runtime normalizes it into serializable content.
- The descriptor (`kind`, `label`, `mime`, optional `width`/`height`) is what the Catalog carries; the callback never is.

## Implement

- The callback runs inside the Container when the Host sends `export.execute`. It may use DOM APIs (`canvas.toBlob`, `MediaRecorder`) — the container realm allows them.
- For simulation tools, replay deterministically from frame 0 in an offscreen renderer and record with `captureStream(0)` + manual `requestFrame()` pacing; keep total time inside the export timeout (default 10s). Reference: `tools/shallow-water/sim/export-replay.ts`.
- Read current values through the session runtime (parameters snapshot + decoded asset state), not from the preview renderer's live frame.
- Never register an exporter after Canvas mount; runtime registration was deleted with the old canvas-export runtime.

## Host Side

- The Host renders Export buttons from the Catalog descriptors and downloads the encoded Blob (Web) or writes it to disk with user confirmation (Desktop). The tool implements nothing UI-side.
- Export shares the command timeout budget; a long encode that exceeds it fails with `export-timeout`.
