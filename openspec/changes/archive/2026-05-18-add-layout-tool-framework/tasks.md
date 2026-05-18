## 1. Dependency and type groundwork

- [x] 1.1 Add `html-to-image` as a runtime dependency and ensure DOM export code loads it only on demand.
- [x] 1.2 Extend shared file-input types with `font` item types, source slot declarations, source slot state, and source collection controller types.
- [x] 1.3 Extend canvas export types with framework-owned DOM export safe options and warning diagnostics without exposing raw `html-to-image` options.

## 2. File input pipeline

- [x] 2.1 Extend file kind inference, accept derivation, validation, and error metadata to support `font`.
- [x] 2.2 Implement font file reading so uploaded fonts can be consumed by layout font helpers without each tool re-reading the File.
- [x] 2.3 Implement named source slot collection state with independent current item, busy, error, ingest, clear, and dispose lifecycle per slot.
- [x] 2.4 Preserve existing single-input controller behavior and add regression tests for image/video/text single-item workflows.
- [x] 2.5 Add tests for font import, unsupported font rejection, slot-specific validation failure, and collection disposal cleanup.

## 3. Tool IO facade and shared UI

- [x] 3.1 Extend the tool IO facade to create and expose single-slot and multi-slot source workflows backed by the file-input pipeline.
- [x] 3.2 Update file summary helpers so font items have stable display summaries.
- [x] 3.3 Update SourceInputSection to auto-detect single-slot versus multi-slot workflows while preserving existing single-source UI behavior.
- [x] 3.4 Update DropZone binding so drop ingest can target a specific named slot.
- [x] 3.5 Add component/runtime tests for SourceInputSection compatibility and slot-aware DropZone ingest.

## 4. DOM export runtime

- [x] 4.1 Replace the current raw DOM clone PNG path with a lazy `html-to-image` adapter for `kind: 'dom'` exporters.
- [x] 4.2 Map framework safe options (`backgroundColor`, `filter`, `cacheBust`, `style`) to the internal DOM capture adapter.
- [x] 4.3 Preserve existing Export panel scale and content size semantics for DOM exporters.
- [x] 4.4 Surface recoverable DOM export warnings, including font fallback warnings, through export diagnostics or result UI.
- [x] 4.5 Add tests for DOM export scale sizing, option mapping, missing element failure, and warning propagation.

## 5. Layout tool SDK

- [x] 5.1 Implement `createLayoutToolController` under the tool SDK public surface with explicit `size`, `sources`, `fonts`, and `export` sections.
- [x] 5.2 Implement the size controller with default/min/max pixel values, editable input state, validation diagnostics, and reactive content dimensions.
- [x] 5.3 Implement the layout source integration so controller slots consume the new tool IO source slot workflow.
- [x] 5.4 Implement the font controller for Google Fonts CSS fetching, font file fetching, uploaded font consumption, font-face CSS generation, browser font registration, cleanup, and warning state.
- [x] 5.5 Implement the export integration so the controller registers and unregisters a `kind: 'dom'` exporter with reactive dimensions and safe DOM export options.
- [x] 5.6 Add unit tests for controller lifecycle, size validation, source slot integration, Google Font success/failure, uploaded font usage, and exporter registration cleanup.

## 6. Scaffolding and documentation

- [x] 6.1 Add a `layout-template` recipe to the tool scaffolding capability list and interactive selection flow.
- [x] 6.2 Generate a complete layout-template starter that wires dynamic size, multiple source slots, Google Font, uploaded font, PreviewCanvas DOM preview, metadata export declaration, and DOM exporter registration.
- [x] 6.3 Ensure generated layout-template code follows the strict tool directory schema and does not declare `three`, `pixi`, or `gsap` by default.
- [x] 6.4 Add `docs/for-tool-developers/` documentation for building layout-template tools with `createLayoutToolController`.
- [x] 6.5 Update existing tool developer overview or recipe documentation to link to the layout-template guide.

## 7. Validation

- [x] 7.1 Run the full Node test suite and update tests until the new and existing IO/export/scaffolding behavior passes.
- [x] 7.2 Run the production build and confirm the new SDK exports, lazy DOM export dependency, and generated starter compile successfully.
- [x] 7.3 Manually scaffold a layout-template tool in a temporary target and verify the generated directory shape, metadata, index, master component, and private components match framework constraints.
