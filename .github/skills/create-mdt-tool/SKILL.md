---
name: create-mdt-tool
description: Create a new tool inside Marble Design Toolset. Use when the user wants to create, add, scaffold, start, or build a new tool in Marble Design Toolset or MDT, including requests such as 新建工具, 创建 Tool, 加一个 Tool, 新 Tool, 工具脚手架, 选择 PreviewCanvas 或 FullStage, or wiring optional tech stacks and export support while adding src/tools/<tool-id>.
---

# Create MDT Tool

Use this skill for repo-scoped new tool creation in Marble Design Toolset.

Do not use this skill for refactoring an existing tool. Keep existing-tool restructuring in a separate skill. Do not use this skill for generic OpenSpec artifact authoring. If the request is mainly about proposing, continuing, applying, verifying, or archiving an OpenSpec change, use the corresponding openspec skill first.

## Outcome

Produce a new tool design or implementation that:

- follows the framework-owned workspace shell contract
- uses the correct tool directory schema and runtime contract
- reads the right docs before coding
- selects the correct right-panel mode and optional tech stack
- integrates export only when the tool actually needs it

## Required Reading Order

Always read these before creating a tool:

1. [framework constraints](./references/framework-constraints.md)
2. [docs reading map](./references/docs-reading-map.md)
3. [tool workflow](./references/tool-workflow.md)

Then branch as needed:

- If the new tool needs export, read [export workflow](./references/export-workflow.md)
- If the new tool uses `three`, `pixi`, or `gsap`, read [tech stack workflow](./references/tech-stack-workflow.md)
- If the new tool is covered by an active OpenSpec change, read that change's `proposal.md`, `design.md`, `tasks.md`, and any scoped `specs/` before coding

## Working Rules

1. Start from the tool request and define the intended `tool-id`, display name, starter shape, and right-panel mode.
2. Read the framework constraints and the docs reading map before proposing structure.
3. Choose the right-panel mode first: `PreviewCanvas`, `FullStage`, or free content in `RightPanel`.
4. Decide whether the tool really needs `three`, `pixi`, `gsap`, or export support before writing code.
5. Prefer the project scaffold when creating a new tool. If hand-writing files, still follow the same schema.
6. Keep `metadata.json` static-only and keep runtime wiring in `index.ts`.
7. Put exactly one root-level master `.svelte` in the tool root. Put every other `.svelte` file under `components/`.
8. Use framework components for shell structure. Do not recreate header, tabs, dialogs, or workspace layout inside a tool.
9. Validate with the narrowest useful check first, then run `npm run build` before considering the task done.

## Completion Checks

Before finishing, confirm all of these:

- new tool files match the required schema
- chosen right-panel mode matches the tool's interaction model
- style choices use CSS Custom Properties and `px`
- any Bits UI wrapper usage preserves required prop forwarding
- `techStack` is declared only in `index.ts` when needed
- export metadata and runtime registration are both present when export is supported
- build passes

## References

- [framework constraints](./references/framework-constraints.md)
- [docs reading map](./references/docs-reading-map.md)
- [tool workflow](./references/tool-workflow.md)
- [tech stack workflow](./references/tech-stack-workflow.md)
- [export workflow](./references/export-workflow.md)
