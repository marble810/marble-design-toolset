---
name: modify-mdt-tool
description: Modify or extend an existing tool inside Marble Design Toolset. Use when the user wants to modify, update, extend, repair, or restructure an existing MDT tool, including requests such as 修改工具, 改造 Tool, 扩展现有 Tool, 修现有工具, 调整 PreviewCanvas 或 FullStage, 补 export, or updating heavy tech stack integration before changing src/tools/<tool-id>.
---

# Modify MDT Tool

Use this skill for repo-scoped changes to an existing tool in Marble Design Toolset.

Do not use this skill for creating a brand new tool. Use create-mdt-tool for that. Do not use this skill for generic OpenSpec artifact authoring. If the request is mainly about proposing, continuing, applying, verifying, or archiving an OpenSpec change, use the corresponding openspec skill first.

## Outcome

Produce an existing-tool change that:

- preserves the framework-owned shell contract
- changes the smallest responsible surface first
- reads the correct docs and active change files before broad edits
- keeps the tool schema coherent after refactor
- adds or changes heavy stacks and export only when justified

## Required Reading Order

Always read these before editing an existing tool:

1. [framework boundaries](./references/framework-boundaries.md)
2. [modify reading order](./references/modify-reading-order.md)
3. [modify workflow](./references/modify-workflow.md)

## Working Rules

1. Start from the target tool folder and the nearest code path that actually controls the behavior.
2. If an active OpenSpec change exists for the tool, read that change before editing code.
3. Read existing tool structure before proposing moves, renames, or new subcomponents.
4. Preserve `metadata.json` as static-only and keep runtime wiring in `index.ts`.
5. Keep exactly one root-level master `.svelte` in the tool root.
6. Put any new private `.svelte` files under `components/`.
7. Re-evaluate right-panel mode only when the current mode no longer matches the tool's behavior.
8. Re-evaluate export and heavy stack integration only when the change actually requires it.
9. Validate the touched slice first, then run `npm run build` before considering the modification done.

## Completion Checks

Before finishing, confirm all of these:

- existing tool schema is still valid
- framework shell boundaries are still preserved
- the changed behavior is controlled by the edited code path
- any added export or heavy stack wiring is intentional and complete
- build passes

## References

- [framework boundaries](./references/framework-boundaries.md)
- [modify reading order](./references/modify-reading-order.md)
- [modify workflow](./references/modify-workflow.md)
