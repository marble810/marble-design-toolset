---
name: create-mdt-tool
description: Create a new Visual Tool Project inside Marble Design Toolset (Deshelf). Use when the user wants to create, add, scaffold, start, or build a new tool, including requests such as 新建工具, 创建 Tool, 加一个 Tool, 新 Tool, 工具脚手架, wiring parameters/inspector/assets/outputs, or adding tools/<slug> under the Catalog-driven Tool Project contract.
---

# Create MDT Tool

Use this skill for repo-scoped new tool creation in Marble Design Toolset.

Do not use this skill for refactoring an existing tool. Keep existing-tool restructuring in a separate skill. Do not use this skill for generic OpenSpec artifact authoring. If the request is mainly about proposing, continuing, applying, verifying, or archiving an OpenSpec change, use the corresponding openspec skill first.

## Outcome

Produce a new Catalog-driven Tool Project under `tools/<slug>/` that:

- has exactly two registration points: root `manifest.json` + fixed `index.ts`
- keeps the Host-owned responsibilities (Parameter Store, Standard Inspector, Session lifecycle) out of the tool
- keeps the simulation/GPU/Canvas hot path inside the Tool Container
- reads the right docs before coding
- builds into the Web static Catalog (and opens on Desktop)

## Required Reading Order

Always read these before creating a tool:

1. [framework constraints](./references/framework-constraints.md)
2. [docs reading map](./references/docs-reading-map.md)
3. [tool workflow](./references/tool-workflow.md)

Then branch as needed:

- If the new tool needs export, read [export workflow](./references/export-workflow.md)
- If the new tool uses `three`, `pixi`, `gsap`, or `vgpu`, read [tech stack workflow](./references/tech-stack-workflow.md)
- If the new tool is covered by an active OpenSpec change, read that change's `proposal.md`, `design.md`, and `tasks.md` before coding

## Working Rules

1. Start from the tool request and define the intended `slug`, display name, and whether a Slate surface is needed.
2. Copy the closest reference project (`tools/hello-canvas/` minimal, `tools/shallow-water/` full-featured) instead of scaffolding from memory; there is no generator CLI anymore.
3. Generate a fresh `projectId` UUID; never reuse one from another project.
4. Declare the flat Parameter set in the Tool Entry `parameters` map with complete constraints; the Host Parameter Store is the validity authority.
5. Build the Inspector tree in `createInspector` with typed handles only; use `visibleWhen` for conditional relevance — never render Tool-owned control panels.
6. Register Main-only callbacks in `privateCallbacks` via `defineInspectorCallback`; public actions go in `commands`.
7. Declare Asset Slots and Visual Outputs as named maps; keep their callbacks in the Main artifact.
8. Keep `index.ts` top-level side-effect free; dynamic-import `canvas/Canvas.svelte` (and optional `slate/Slate.svelte`).
9. Validate with the narrowest useful check first, then `bun run forge:web-catalog` and `bun test` before considering the task done.

## Completion Checks

Before finishing, confirm all of these:

- root has only `manifest.json` + `index.ts` as registration points
- `index.ts` is a single `export default defineVisualTool(...)` with no top-level side effects
- Canvas/Slate are dynamic imports; no runtime exporter registration anywhere
- private callbacks use the named map; no inline anonymous handlers
- declared `libraries` match actual bare imports
- `bun run forge:web-catalog` reports the tool as a usable entry (no diagnostics)
- `bun test` and `bun run typecheck` pass

## References

- [framework constraints](./references/framework-constraints.md)
- [docs reading map](./references/docs-reading-map.md)
- [tool workflow](./references/tool-workflow.md)
- [tech stack workflow](./references/tech-stack-workflow.md)
- [export workflow](./references/export-workflow.md)
