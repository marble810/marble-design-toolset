# Modify Workflow

Follow this sequence for changes to an existing Tool Project (`tools/<slug>/`).

## 1. Start From The Controlling Surface

- Begin with the tool's root folder.
- Step to the nearest private module that directly controls the requested behavior (e.g. `sim/runtime.ts` for simulation behavior, `parameters.ts` for parameter semantics, `inspector.ts` for the control tree, `sim/export-replay.ts` for exports).
- Do not start with broad repo exploration unless the controlling path is genuinely unclear.

## 2. Confirm The Current Tool Contract

Confirm:

- current `manifest.json` identity + declared `libraries`
- current parameter set, constraints and modes
- current surfaces (canvas only, or canvas + slate)
- current assets/outputs declarations
- whether the file layout already violates the two-registration-points rule

## 3. State The Intended Change

Before editing, decide whether the change is:

- behavior-only (Canvas/private module logic)
- parameter/descriptor change (affects Catalog + Reload migration)
- inspector tree change (build-time extraction)
- asset/output integration or repair
- framework library addition or removal

Use the smallest change category that fits.

## 4. Edit Locally First

- Prefer the smallest local edit that tests the hypothesis.
- Only split modules (`sim/`, `canvas/`, `slate/`) when the current structure clearly blocks the change.
- Preserve stable IDs (map keys) unless the request requires renaming — stable IDs feed Catalog descriptors, Inspector bindings and Reload migration.

## 5. Re-check Boundaries After Modification

After editing, verify:

- `index.ts` still has exactly one `export default defineVisualTool(...)` and no top-level side effects
- no tool-side parameter store, no runtime exporter registration, no Tool-owned panels
- Canvas/Slate still dynamic imports
- private callbacks still registered in the `privateCallbacks` named map

## 6. Validate Narrowly, Then Broadly

- run the narrowest useful test for the touched slice (pure modules first — see `tools/shallow-water/sim/renderer-math.test.ts`)
- `bun run forge:web-catalog` must keep the tool a usable entry with no diagnostics
- then `bun test` and `bun run typecheck`
- exercise the changed behavior on `/` (Host chrome) — parameter flow, resimulate, export, restart as relevant

## 7. Final Review

- confirm the new behavior works in the container (not just in unit tests)
- confirm no unrelated tool contract was broken
- confirm descriptor changes stay Reload-compatible (same type, values still within constraints) or intentionally reset
- confirm any new docs or spec references were actually followed
