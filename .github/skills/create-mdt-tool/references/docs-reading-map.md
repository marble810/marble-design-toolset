# Docs Reading Map

Read these before writing code. All developer docs are Chinese.

| Topic | Doc |
|---|---|
| Target architecture (deep) | `docs/architecture/deshelf-architecture.md` |
| Tool Project walkthrough | `docs/for-tool-developers/create-a-tool.md` |
| Tool author entry point | `docs/for-tool-developers/overview.md` |
| Visual Output / export | `docs/for-tool-developers/export.md` |
| Web adapter details | `docs/for-framework-developers/web-iframe-adapter.md` |
| Desktop adapter details | `docs/for-framework-developers/desktop-adapter.md` |
| Host runtime & workspace | `docs/for-framework-developers/runtime-and-shell.md` |
| Tool SDK surface | `docs/for-framework-developers/public-sdk.md` |
| Builder pipeline & references | `docs/for-framework-developers/scaffolding-and-recipes.md` |

Priority rule: the Tool-author docs are the contract; framework docs explain why the seams exist. Reference implementations in `tools/hello-canvas/` and `tools/shallow-water/` always win over prose when they disagree — and if they disagree, fix the doc.

Removed-world warning: any doc describing `metadata.json`, master Svelte components, `tool-registry.ts`, Tool-owned panels, or `createToolSourceInput` describes the deleted pre-MAB-70 runtime. Do not follow it; fix or delete the doc instead.
