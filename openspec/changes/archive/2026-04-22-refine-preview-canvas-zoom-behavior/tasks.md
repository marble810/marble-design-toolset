## 1. OpenSpec artifacts and contracts

- [x] 1.1 Finalize the PreviewCanvas zoom design and delta specs for `right-panel-modes` and `tool-shell-workspace`
- [x] 1.2 Keep the change scoped to PreviewCanvas semantics, documentation, and existing right-panel contracts

## 2. PreviewCanvas implementation

- [x] 2.1 Add the optional `defaultZoom` prop to PreviewCanvas with a backward-compatible default of `Fit`
- [x] 2.2 Refactor PreviewCanvas state to separate logical zoom from CSS render scale
- [x] 2.3 Update Fit, 1:1, zoom percentage, and button or wheel zoom behavior to use device-pixel-normalized logical zoom
- [x] 2.4 Handle `devicePixelRatio` changes without changing the current logical zoom value
- [x] 2.5 Add a raster-focused pixelated presentation baseline without coupling PreviewCanvas to renderer internals

## 3. Documentation and consumers

- [x] 3.1 Update PreviewCanvas authoring guidance to document `defaultZoom`, normalized `1:1`, and the `FullStage` boundary
- [x] 3.2 Review existing PreviewCanvas consumers and keep their default behavior as `Fit` unless an explicit initial mode is needed

## 4. Verification

- [x] 4.1 Verify `defaultZoom` works for both `Fit` and `1:1`
- [x] 4.2 Verify manual zoom states, including `1:1`, keep a stable zoom percentage and visible preview scale across browser zoom or DPI changes
- [x] 4.3 Verify pan and wheel zoom interactions still behave correctly after the zoom-model refactor
- [x] 4.4 Run the repository build or equivalent validation and confirm existing PreviewCanvas consumers do not regress