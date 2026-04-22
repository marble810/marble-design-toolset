## 1. Shared Types And Helpers

- [x] 1.1 Add shared file-input type definitions for allowed kinds, normalized imported items, controller state, and stable error codes in src/lib/types and expose them through the shared runtime entrypoints.
- [x] 1.2 Implement pure helper modules under src/lib/runtime/file-input for accept string derivation, file kind detection, single-file validation, and drag/drop file extraction.
- [x] 1.3 Implement browser-backed reader helpers that normalize image, video, and text files into typed results, including metadata loading and object URL lifecycle utilities.

## 2. Controller Implementation

- [x] 2.1 Create a file-input controller in src/lib/runtime/file-input that exposes reactive state and actions for accept, busy, currentItem, lastError, pick, ingestFiles, clear, and dispose.
- [x] 2.2 Route picker-selected files and drop-provided files through the same ingest path so unsupported, empty, and multi-file submissions surface stable errors without replacing the last successful item.
- [x] 2.3 Ensure successful replacements, clear(), and dispose() revoke previously created object URLs and always leave the controller out of busy state after success or failure.

## 3. Verification And Documentation

- [x] 3.1 Add focused tests for kind filtering, normalized image/video/text results, stable failure states, last-success preservation, and temporary resource cleanup.
- [x] 3.2 Update the relevant docs under docs/guides and docs/architecture so tool authors know when to use the unified file-input pipeline, how to wire hidden file inputs and drop zones, and how normalized results and cleanup behave.
- [x] 3.3 Update AGENTS.md and the relevant Copilot skill references so future tool work treats the unified file-input pipeline as the default path for image, video, and text file ingestion.
- [x] 3.4 Validate the new module with the narrowest available test or type-check commands and confirm the change is apply-ready in OpenSpec status output.