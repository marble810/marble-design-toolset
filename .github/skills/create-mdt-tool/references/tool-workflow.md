# Tool Workflow

Follow this sequence for new tool design and implementation.

## 1. Define The New Tool Brief

- Determine the intended `tool-id`.
- Determine the English display name.
- Determine the right-panel mode.
- Determine whether the scaffold should be used.
- If there is an active OpenSpec change for this tool, read it before writing code.

## 2. Choose The Right-Panel Mode First

Pick one mode before designing component structure for the new tool.

- Use `PreviewCanvas` for fixed-size 2D content that benefits from fit, 1:1, zoom, pan, and checkerboard support.
- Use `FullStage` for full-bleed interactive scenes such as WebGL or similar stage-driven content.
- Use free content inside `RightPanel` when the tool is not preview-centric and does not need the shared preview behavior.

## 3. Decide On Optional Capabilities

Decide early whether the new tool needs:

- `three`
- `pixi`
- `gsap`
- local image / video / text import
- image export
- video export

Only add these when the tool genuinely needs them.

## 4. Create The Tool Schema

Preferred path:

1. run `bun run create:tool`
2. choose starter type that matches the selected right-panel mode
3. choose optional tech stacks only when needed

If hand-writing files, ensure:

- `metadata.json` stays static-only
- `index.ts` exports a `ToolDefinition`
- the master `.svelte` is the only root-level Svelte file
- other Svelte files move under `components/`

## 5. Compose New UI Inside Framework Boundaries

Use these framework-owned pieces as your structure:

- `LeftPanel`
- `Section`
- `RightPanel`
- `PreviewCanvas` or `FullStage` when needed

Do not recreate `ToolShell`. The framework already mounts the tool inside it.

## 6. Implement State And Rendering

- Keep tool-local state inside the new tool or its private child components.
- Prefer simple, explicit data flow.
- For preview tools, keep `contentWidth` and `contentHeight` accurate.
- For dynamic or interactive renderers, ensure mount and cleanup are symmetrical.
- For local image / video / text inputs, route picker and drop handling through `src/lib/runtime/file-input/` instead of bespoke browser file handling.

## 7. Validate Narrowly, Then Broadly

After the first meaningful edit, run the smallest relevant check.

Examples:

- a focused test file for touched runtime logic
- a narrow compile or typecheck if available
- then `npm run build`

## 8. Final Review Checklist

- new tool schema is correct
- framework boundaries are preserved
- mode selection still matches behavior
- docs and specs used by this change were actually read
- export and heavy stack features were only added when needed
- new tool is ready to enter the catalog after build
