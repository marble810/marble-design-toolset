# Export Workflow

Read this only when the tool needs image or video export.

## Read First

1. `docs/guides/Making Tools/tool-export-guide.md`
2. `openspec/specs/tool-canvas-export/spec.md`

## Decision Rule

Do not add export by default. Add it only when the tool has a real user-facing need to export generated output.

## Required Pieces

If export is supported, both layers must exist:

1. metadata declaration in `metadata.json`
2. runtime exporter registration from the tool's rendering side

If metadata declares export but no exporter registers at runtime, the framework will surface disabled export controls.

## Choose The Export Source

- Use `canvas` when the tool already renders to a canvas that can be captured directly.
- Use `render` when deterministic frame rendering is needed.
- Use `dom` when the export source is DOM-driven and must be rasterized.

## Integration Checklist

- metadata export flags match the real capabilities
- exporter reports accurate content size
- registration lifecycle is tied to mount and cleanup
- image and video affordances only appear when truly supported
- build still passes after wiring export
