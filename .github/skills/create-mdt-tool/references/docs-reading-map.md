# Docs Reading Map

Use this map to decide what to read before creating a new tool.

## Always Read

1. `AGENTS.md`
2. `docs/architecture/project-architecture-analysis.md`
3. `docs/guides/Making Tools/tool-authoring-guide.md`
4. `openspec/specs/tool-module-runtime/spec.md`
5. `openspec/specs/tool-shell-workspace/spec.md`
6. `openspec/specs/right-panel-modes/spec.md`

## Read When Styling Or Wrapping UI

- `docs/guides/Styles/css-styling-guide.md`
- `openspec/specs/pixel-ui-foundation/spec.md`

## Read When Adding Export

- `docs/guides/Making Tools/tool-export-guide.md`
- `openspec/specs/tool-canvas-export/spec.md`

## Read When Importing Local Files

- `docs/guides/Making Tools/tool-file-input-guide.md`

## Read When Using Heavy Tech Stacks

- For `pixi`: `docs/guides/Making Tools/tool-pixi-guide.md`
- For `three`: `docs/guides/Making Tools/tool-threejs-guide.md`
- For `gsap`: inspect existing runtime typing and usage patterns in the codebase, then keep the declaration in `index.ts`

## Read When Creating A Brand New Tool

- Prefer the scaffold first: `bun run create:tool`
- Then read `openspec/specs/tool-scaffolding/spec.md` if scaffold output or schema behavior needs explanation

## Read When A Change Already Exists

If the new tool is covered by an active change under `openspec/changes/<change-name>/`, read these before coding:

1. `proposal.md`
2. `design.md`
3. `tasks.md`
4. any scoped `specs/**/*.md`

Use the active change as the source of truth for that tool slice.
