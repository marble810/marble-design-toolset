# Framework Boundaries

Read this first. These constraints still apply during modifications.

## Shell Ownership

- The workspace shell is framework-owned.
- An existing tool may only change its own left-side and right-side content.
- Do not move header, tabs, dialogs, or workspace-state responsibilities into a tool.
- `LeftPanel` already owns `MainInfo` injection.

## File Schema

- Every tool lives in `src/tools/<tool-id>/`.
- Keep `tool-id` in kebab-case.
- Keep exactly one root-level master `.svelte`.
- Keep private child `.svelte` files under `components/`.

## Metadata And Runtime

- `metadata.json` remains static-only.
- `index.ts` remains the runtime definition entry.
- Keep `techStack` declarations in `index.ts`, not in `metadata.json`.
- Keep local image, video, and text file ingestion on the shared `src/lib/runtime/file-input/` path instead of bespoke browser file handling.

## Styling And UI

- Do not introduce Tailwind.
- Use CSS Custom Properties and `px` units.
- Keep shared UI copy in English.
- Keep Bits UI prop forwarding intact when touching wrapped interactive primitives.
