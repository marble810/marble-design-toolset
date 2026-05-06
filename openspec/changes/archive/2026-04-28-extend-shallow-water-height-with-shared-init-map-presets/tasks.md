## 1. Shared preset init map runtime

- [x] 1.1 Create a shared preset init map source module under `src/lib/runtime/` with discriminated preset types, defaults, parameter normalization, and `fill` / `outline` mode modeling for circle and square.
- [x] 1.2 Implement deterministic raster generation for `circle`, `square`, `horizontal-bar`, and `vertical-bar`, using normalized position, size/thickness, feather semantics, and adjustable outline width for outlined circle/square presets.
- [x] 1.3 Add focused tests or helper-level verification for preset raster determinism and cross-resolution parameter consistency.

## 2. Shallow Water input integration

- [x] 2.1 Refactor `src/tools/shallow-water-height/` to model init map input as explicit source modes (`image` and `preset`) instead of a file-only path.
- [x] 2.2 Add left-panel controls for preset source selection and parameter editing, including circle/square fill-or-outline mode, position, size, outline width, feather, and bar position + thickness + feather.
- [x] 2.3 Update the preview/simulation initialization path so image imports and preset changes both rebuild the init map and reset the simulation from a fresh source.

## 3. Video-only export behavior

- [x] 3.1 Change `shallow-water-height` metadata and exporter capability declarations so the tool exposes video export only.
- [x] 3.2 Verify the tool no longer exposes static image export UI while keeping deterministic render-based video export behavior intact.

## 4. Validation

- [x] 4.1 Run the narrowest relevant checks for the shared preset runtime and shallow-water-height tool changes.
- [x] 4.2 Run `npm run build` and resolve any compile or integration issues introduced by this change.
- [x] 4.3 Manually verify image mode, preset mode, preset parameter updates, and video-only export visibility in the browser.