## Context

PreviewCanvas currently exposes a simple zoom model: `fit` computes a CSS scale from viewport CSS pixels, and `manual` stores a scale value that is written directly into the preview content transform. That implementation is enough for generic zooming, but it does not preserve a stable user-facing meaning for `1:1` or the displayed zoom percentage once browser zoom or `devicePixelRatio` changes.

The requested behavior is more specific than a new prop. PreviewCanvas needs an initial zoom contract and a zoom model that reflects content pixels against device pixels so raster previews can remain visually stable across DPI and browser zoom changes. At the same time, the framework already established an important boundary: PreviewCanvas is the shared 2D shell, while renderer-managed canvas and WebGL flows use `FullStage` and manage their own backing resolution.

## Goals / Non-Goals

**Goals:**
- Add an optional `defaultZoom` prop so tools can select whether PreviewCanvas opens in `Fit` or `1:1` mode.
- Redefine PreviewCanvas zoom state around a logical zoom model where `100%` means one content pixel maps to one device pixel.
- Keep manual zoom states, including `1:1`, stable when `devicePixelRatio` changes, while allowing `Fit` to recompute from the current available viewport.
- Preserve PreviewCanvas as the shared CSS-transform-based 2D shell while clarifying its raster-focused pixel-perfect boundary.

**Non-Goals:**
- Do not expand PreviewCanvas into a renderer-managed stage for Pixi, Three, or arbitrary canvas plumbing.
- Do not make `defaultZoom` a controlled prop that keeps syncing after initialization.
- Do not promise that arbitrary DOM text or borders render with sprite-like sharpness at every fractional DPR.
- Do not introduce new right-panel container types or change `FullStage` responsibilities.

## Decisions

### Decision 1: `defaultZoom` initializes internal mode only

PreviewCanvas will accept `defaultZoom: 'Fit' | '1:1'` and default to `Fit`. The prop is read when the component initializes its zoom state; after that, the existing internal interactions remain authoritative.

Alternatives considered:
- Make `defaultZoom` fully controlled by the parent: rejected because the request is about initial window behavior, not external state control.
- Require every tool to call imperative setup logic: rejected because the shell should own its own preview defaults.

### Decision 2: split logical zoom from render scale

The stored user-facing zoom value becomes a logical zoom that represents device-pixel mapping, while the actual CSS transform scale becomes `logicalZoom / devicePixelRatio`. The toolbar percentage reflects the logical zoom, not the raw render scale.

Alternatives considered:
- Keep using CSS scale directly and only rename labels: rejected because it would not change the unstable behavior the user asked to fix.
- Normalize everything at the renderer level: rejected because PreviewCanvas intentionally accepts generic 2D content, not only renderer-owned canvases.

### Decision 3: Fit is computed in device-pixel space

Fit will derive the available preview size from viewport CSS pixels multiplied by `devicePixelRatio`, then calculate the logical zoom from that device-pixel budget. This preserves a consistent semantic meaning for Fit as browser zoom changes.

Alternatives considered:
- Keep Fit in CSS-pixel space and only normalize 1:1: rejected because the visible zoom percentage would still drift between modes.
- Apply inverse transforms on the viewport container: rejected because it complicates pointer math and does not solve the semantic mismatch cleanly.

### Decision 4: pixel-perfect guarantees stop at raster presentation

PreviewCanvas may provide a shared pixelated presentation baseline for raster descendants such as `canvas` and `img`, but it will not manage backing stores or renderer pixel ratios. Tools that need exact render-surface control continue to use `FullStage` and set their own renderer resolution, as `three-cube` already does.

PreviewCanvas also owns the outer frame treatment of the scaled preview surface so tools do not each invent their own root-level border or inset shadow. Child content remains responsible for its own interior composition only.

Alternatives considered:
- Make PreviewCanvas inspect and reconfigure nested canvases: rejected because it couples the shell to renderer internals.
- Promise pixel-perfect behavior for all DOM content: rejected because browser text and layout rendering are not controllable at that level.

## Risks / Trade-offs

- [Behavior shift for existing `1:1`] → Existing PreviewCanvas consumers may notice that `1:1` no longer means raw CSS scale. Mitigation: keep the default entry mode as `Fit` and document the semantic change clearly.
- [Fractional DPR DOM softness] → Some DOM-based previews may still show antialiasing differences under fractional DPI values. Mitigation: constrain the pixel-perfect guarantee to raster descendants and document the boundary.
- [Pointer interaction regressions] → Changing zoom math can introduce pan/drag coordinate bugs. Mitigation: keep pan in viewport CSS coordinates and verify drag behavior after the render-scale split.

## Migration Plan

1. Create the delta specs that redefine PreviewCanvas zoom semantics and initial zoom behavior.
2. Refactor PreviewCanvas to separate logical zoom from render scale and listen for DPR changes.
3. Update authoring documentation to explain `defaultZoom`, normalized 1:1 behavior, and when to use `FullStage` instead.
4. Validate behavior under multiple browser zoom levels before completing the change.

## Open Questions

- No blocking open questions remain for implementation. If validation shows that existing DOM-only previews are insufficient to demonstrate the raster guarantee, implementation may add a minimal raster fixture for verification.