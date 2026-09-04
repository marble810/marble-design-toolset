# Modify Reading Order

Use this reading order before changing an existing tool.

## Always Read

1. `AGENTS.md`
2. `docs/architecture/deshelf-architecture.md`
3. `docs/for-tool-developers/overview.md`
4. `docs/for-framework-developers/runtime-and-shell.md`

## Read The Existing Tool Itself

Before designing a modification, read (under `tools/<slug>/`):

1. `manifest.json`
2. `index.ts`
3. the private module that actually controls the behavior being changed (`sim/`, `canvas/`, `inspector.ts`, `outputs.ts`, …)
4. any sibling module the change couples to (e.g. realm-scoped session holder)

## Read Change Files When Present

If there is an active change under `openspec/changes/<change-name>/` for this tool, read:

1. `proposal.md`
2. `design.md`
3. `tasks.md`

Use the active change as the governing source for that slice.

## Read When The Scope Touches These Areas

- Parameter/Inspector semantics: `docs/for-tool-developers/create-a-tool.md`
- Export changes: `docs/for-tool-developers/export.md`
- Web adapter behavior (iframe container, static catalog): `docs/for-framework-developers/web-iframe-adapter.md`
- Desktop adapter behavior (Open Project, build cache): `docs/for-framework-developers/desktop-adapter.md`
- Builder pipeline changes: `docs/for-framework-developers/scaffolding-and-recipes.md`
