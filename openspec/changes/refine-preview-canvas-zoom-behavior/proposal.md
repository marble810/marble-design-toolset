## Why

PreviewCanvas currently treats Fit, 1:1, and the displayed zoom percentage as direct CSS transform scale values. That makes the same nominal zoom behave differently across browser zoom levels and devicePixelRatio values, which breaks the expected pixel-perfect meaning of 1:1 for raster previews. The shell also lacks a way for tools to declare the initial zoom mode when a preview opens.

## What Changes

- Add an optional `defaultZoom` prop to PreviewCanvas so tools can open in either `Fit` or `1:1` mode without extra setup.
- Redefine PreviewCanvas zoom behavior around a device-pixel-normalized logical zoom model so Fit, 1:1, and zoom percentage remain stable when browser zoom or DPI changes.
- Keep PreviewCanvas as the shared 2D preview shell that renders via CSS transform, but derive its render scale from logical zoom and `devicePixelRatio` rather than equating CSS scale with user-facing zoom.
- Clarify that pixel-perfect guarantees apply to raster preview surfaces and pixelated presentation hints, while renderer-managed canvas and WebGL workflows remain on `FullStage`.
- Update the shell specs and authoring documentation so PreviewCanvas no longer implies that `1:1` means raw CSS-pixel scale.

## Capabilities

### New Capabilities

### Modified Capabilities
- `right-panel-modes`: PreviewCanvas gains an initial zoom contract and device-pixel-normalized zoom semantics for 2D preview rendering.
- `tool-shell-workspace`: Shared preview navigation requirements for Fit and 1:1 are refined so the user-visible zoom remains stable across DPI and browser zoom changes.

## Impact

- Affected component: `src/lib/components/shell/preview-canvas/PreviewCanvas.svelte`
- Affected specs: `openspec/specs/right-panel-modes/spec.md`, `openspec/specs/tool-shell-workspace/spec.md`
- Affected documentation: `docs/tool-authoring-guide.md`, `docs/pixel-tool-framework-architecture.md`
- Existing PreviewCanvas consumers may optionally pass `defaultZoom`, but the default behavior remains `Fit`
- No new runtime dependencies and no new right-panel container types