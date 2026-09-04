---
name: modify-mdt-tool
description: Modify or extend an existing Visual Tool Project inside Marble Design Toolset (Deshelf). Use when the user wants to modify, update, extend, repair, or restructure an existing tool, including requests such as 修改工具, 改造 Tool, 扩展现有 Tool, 修现有工具, 补 parameter/inspector/asset/output, or adjusting simulation/rendering behavior under tools/<slug>.
---

# Modify MDT Tool

Use this skill for repo-scoped changes to an existing tool in Marble Design Toolset.

Do not use this skill for creating a brand new tool. Use create-mdt-tool for that. Do not use this skill for generic OpenSpec artifact authoring. If the request is mainly about proposing, continuing, applying, verifying, or archiving an OpenSpec change, use the corresponding openspec skill first.

## Outcome

Produce an existing-tool change that:

- preserves the two registration points (root `manifest.json` + `index.ts`)
- keeps Host-owned responsibilities (Parameter Store, Standard Inspector, lifecycle) out of the tool
- changes the smallest responsible surface first
- reads the correct docs and active change files before broad edits
- keeps the Catalog extraction passing after refactor

## Required Reading Order

Always read these before editing an existing tool:

1. [framework boundaries](./references/framework-boundaries.md)
2. [modify reading order](./references/modify-reading-order.md)
3. [modify workflow](./references/modify-workflow.md)

## Working Rules

1. Start from the target Tool Project (`tools/<slug>/`) and the nearest code path that actually controls the behavior (Canvas runtime module, parameter view, export replay).
2. If an active OpenSpec change exists for the tool, read that change before editing code.
3. Parameter changes go through the flat `parameters` map + constraints — never introduce a tool-side parameter store or `$state` mirror of Host state.
4. Inspector changes are build-time tree changes: edit `createInspector` (typed handles, `visibleWhen`), never add runtime control components.
5. New Main-only callbacks must be registered in `privateCallbacks`/`commands` named maps; bump nothing else in the registration surface.
6. Simulation/renderer edits stay inside the Container (private modules); keep hot-path state out of the Environment API.
7. When touching descriptors (parameters/assets/outputs/inspector), expect the Catalog entry to change; Reload migration must keep old values valid (same type + still within the new constraint) or they reset to defaults.
8. Validate the touched slice first, then `bun run forge:web-catalog`, `bun test`, and `bun run typecheck` before considering the modification done.

## Completion Checks

Before finishing, confirm all of these:

- registration points are intact; `index.ts` still has no top-level side effects
- the changed behavior is controlled by the edited code path
- descriptor changes keep Reload compatibility in mind (type/constraint compatibility)
- no runtime exporter/panel/store registration crept back in
- `bun run forge:web-catalog` succeeds; `bun test` and `bun run typecheck` pass

## References

- [framework boundaries](./references/framework-boundaries.md)
- [modify reading order](./references/modify-reading-order.md)
- [modify workflow](./references/modify-workflow.md)
