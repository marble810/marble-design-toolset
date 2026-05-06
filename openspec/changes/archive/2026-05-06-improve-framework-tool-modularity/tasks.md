## 1. Runtime Contract Foundation

- [x] 1.1 Add a tool runtime context that exposes `toolId`, metadata, session active state, menu actions, menu dispatch, and declared tech stack access.
- [x] 1.2 Wire `ToolSession` and `ToolShell` to provide the new runtime context without breaking existing shell contexts.
- [x] 1.3 Add menu action dispatch support from `MainInfo` through `ToolSession` to the current tool definition handler.
- [x] 1.4 Add contract validation for tool directory schema, metadata fields, single root-level master component, PascalCase master name, private component location, and tech stack whitelist.
- [x] 1.5 Add tests covering runtime context values, menu action fallback behavior, and contract validation failures.

## 2. Tool IO And Shared Workflow UI

- [x] 2.1 Add a tool-facing IO facade that creates source workflows from one stable import path while reusing the existing file-input pipeline.
- [x] 2.2 Add SourceInputSection and DropZone bindings that consume the same source workflow object and remove repeated tool-side picker/drop glue.
- [x] 2.3 Add shared file summary helpers and a reusable Blob download primitive, keeping workspace persistence and canvas export pipeline boundaries separate.
- [x] 2.4 Add shared Field wrapper, SelectField, CheckboxField, SegmentedControl, and PresetGrid components under the existing UI conventions.
- [x] 2.5 Migrate one file-input tool to the tool IO facade, SourceInputSection, and DropZone while preserving existing file-input runtime behavior.
- [x] 2.6 Migrate `aspect-ratio` preset and dimension fields to shared workflow UI components.

## 3. Canvas Export Refinement

- [x] 3.1 Extend exporter registration data to include stable exporter ids and optional labels for multi-exporter UI.
- [x] 3.2 Update Export Section to show an exporter selector only when multiple exporters are registered.
- [x] 3.3 Update Export Section default filenames to use runtime context `toolId` instead of slugifying metadata name.
- [x] 3.4 Add mismatch diagnostics for missing exporter, declared image without PNG capability, declared video without runtime/browser support, and exporter loss during selection.
- [x] 3.5 Add tests for exporter selection, filename generation, capability mismatch diagnostics, and busy/result state transitions.

## 4. Render Host Lifecycle

- [x] 4.1 Design and add render host lifecycle helpers for Canvas2D, Pixi, and Three without introducing new heavy dependencies.
- [x] 4.2 Ensure helpers support session active pause/resume, initialization errors, resize handling, and deterministic dispose.
- [x] 4.3 Add export registration helpers for canvas and render callback descriptors with automatic unregister on destroy.
- [x] 4.4 Migrate `noise-texture-creater` preview to the Pixi render host helper.
- [x] 4.5 Migrate `shallow-water-height` preview/export lifecycle to the Three/render helper where practical.
- [x] 4.6 Add tests or lightweight harness coverage for lifecycle cleanup and session pause/resume behavior.

## 5. Workspace Controller Split

- [x] 5.1 Extract workspace tab, hash, persistence, catalog, and left-panel width operations from `+page.svelte` into controller-level modules.
- [x] 5.2 Split Open Tool, Help, Settings, and empty-state UI into focused workspace components while preserving existing English shared copy.
- [x] 5.3 Add or update tests proving hash restore, localStorage restore, tab close/activate, and left-panel width behavior remain unchanged.

## 6. Scaffold And Docs Alignment

- [x] 6.1 Update tool scaffold templates to use the new shared workflow UI and render host lifecycle patterns.
- [x] 6.2 Update scaffold tests to assert generated tools still satisfy the strengthened contract validation.
- [x] 6.3 Update Making Tools docs to remove custom `toDataURL()` / anchor download patterns and point export examples to canvas export runtime.
- [x] 6.4 Update authoring docs with the new runtime context, tool IO facade, SourceInputSection, DropZone, and render host lifecycle guidance.

## 7. Verification

- [x] 7.1 Run the project test command and fix regressions within the scope of this change.
- [x] 7.2 Run the production build and fix regressions within the scope of this change.
- [x] 7.3 Manually smoke-test representative tools: `aspect-ratio`, `chromatic-aberration`, `noise-texture-creater`, and `shallow-water-height`.