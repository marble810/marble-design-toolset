# Tool Workflow

Follow this sequence for new Tool Project design and implementation.

## 1. Define The Tool Brief

- Determine the intended `slug` (kebab-case) and English display name.
- Determine whether a second surface (Tool Slate) is genuinely needed.
- If there is an active OpenSpec change for this tool, read it before writing code.

## 2. Pick The Reference Project

Copy the closest existing Tool Project and trim it — do not scaffold from memory:

- `tools/hello-canvas/`: minimal — parameters, one computed, one command, one private callback, Canvas + Slate, one image output.
- `tools/shallow-water/`: full — GPU simulation hot path, Asset Slot, Inspector `visibleWhen`, deterministic PNG/video Visual Outputs.

## 3. Create The Registration Points

- `manifest.json`: fresh `projectId` UUID, slug, name, version `1.0.0`, `forgeProfile: "forge-v1"`, `libraries` matching actual bare imports.
- `index.ts`: single `export default defineVisualTool({ ... })`, top-level side-effect free.

## 4. Model The Parameter Set

- Keep it flat; every entry gets a complete `constraint` (the Host Store rejects out-of-range writes).
- Renderer-facing numeric views (select strings → numbers, rounding) belong in a tool-private module reading the snapshot — see `tools/shallow-water/parameters.ts`.
- Do not add product-meaningless parameters to satisfy computed coverage; add `computed` only for real derived values (with `compute` + `dependsOn`).

## 5. Build The Inspector Tree

- Use typed handles (`parameters.<id>`, `commands.<id>`, `privateCallbacks.<id>`).
- Express the old "hide irrelevant controls" behavior with `visibleWhen` + section nesting.
- Inspector buttons bind to `privateCallbacks` (Inspector-only) or `commands` (publicly invocable via the Host command API).

## 6. Implement The Canvas

- Everything rAF/GPU/simulation stays inside `canvas/Canvas.svelte` (and tool-private modules).
- Subscribe to `context.parameters` / `context.assets` mirrors; re-seed simulation state only on structural changes (source, resolution, amplitude, invert, explicit resimulate).
- Per-session runtime state: use a `createRuntime(context)` factory created on mount plus a realm-scoped holder for entry-side callbacks (see `tools/shallow-water/sim/runtime.ts` + `sim/session.ts`). Reload/Restart replaces the realm, so this is session-isolated by construction.
- Dispose GPU resources, object URLs and subscriptions on unmount; `dispose()` in the Tool Entry clears module-level bindings.

## 7. Validate Narrowly, Then Broadly

After the first meaningful edit, run the smallest relevant check:

- a focused test for pure math/decoding modules (see `tools/shallow-water/sim/renderer-math.test.ts`)
- `bun run forge:web-catalog` — the tool must become a usable Catalog entry; fix reported diagnostics first
- open `/` (after `bun run dev` or `bun run build`) and exercise the tool in the Host chrome
- then `bun test` and `bun run typecheck`

## 8. Final Review Checklist

- registration points intact (no second entry, no runtime registration)
- framework boundaries preserved (no Tool-owned panels, no Host store duplication)
- hot path inside the Container; only small control messages cross the Environment API
- docs and specs used by this change were actually read
- export/asset/library features added only when needed and fully declared
- the tool is ready to enter the Catalog after `forge:web-catalog`
