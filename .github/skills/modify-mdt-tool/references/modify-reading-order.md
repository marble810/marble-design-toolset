# Modify Reading Order

Use this reading order before changing an existing tool.

## Always Read

1. `AGENTS.md`
2. `docs/architecture/project-architecture-analysis.md`
3. `docs/guides/Making Tools/tool-authoring-guide.md`
4. `openspec/specs/tool-module-runtime/spec.md`
5. `openspec/specs/tool-shell-workspace/spec.md`
6. `openspec/specs/right-panel-modes/spec.md`

## Read The Existing Tool Itself

Before designing a modification, read:

1. `src/tools/<tool-id>/metadata.json`
2. `src/tools/<tool-id>/index.ts`
3. the root-level master `.svelte`
4. the nearest private child components that actually control the behavior being changed

## Read Change Files When Present

If there is an active change under `openspec/changes/<change-name>/` for this tool, read:

1. `proposal.md`
2. `design.md`
3. `tasks.md`
4. any scoped `specs/**/*.md`

Use the active change as the governing source for that slice.

## Read When Styling Or Export Is In Scope

- Styling or Bits UI wrappers: `docs/guides/Styles/css-styling-guide.md`
- Export changes: `docs/guides/Making Tools/tool-export-guide.md` and `openspec/specs/tool-canvas-export/spec.md`
- Local image / video / text inputs: `docs/guides/Making Tools/tool-file-input-guide.md`
- `pixi`: `docs/guides/Making Tools/tool-pixi-guide.md`
- `three`: `docs/guides/Making Tools/tool-threejs-guide.md`
