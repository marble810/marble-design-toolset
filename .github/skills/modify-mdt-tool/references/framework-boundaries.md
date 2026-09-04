# Framework Boundaries

Read this first. These constraints still apply during modifications.

## Ownership

- Deshelf Host owns the workspace shell, Standard Inspector, Parameter Store, Session lifecycle, Asset selection and Export orchestration.
- An existing tool owns only its Canvas/Slate surfaces and the Tool Entry callback implementations.
- Do not move host responsibilities (parameter validity, inspector rendering, lifecycle, export UI) into the tool.
- Simulation/GPU/Canvas hot paths stay inside the Tool Container; they never cross the Environment API.

## File Schema

- Every tool lives in `tools/<slug>/` (kebab-case slug).
- Keep exactly two registration points: root `manifest.json` + fixed `index.ts`.
- `index.ts` keeps a single `export default defineVisualTool(...)` with no top-level side effects.
- Private modules (`parameters.ts`, `inspector.ts`, `outputs.ts`, `sim/`, `canvas/`, `slate/`, …) are organization only — never a second registration entry.

## Manifest And Descriptors

- `manifest.json` remains a closed static schema (identity, `contractVersion`, `forgeProfile`, `libraries`; optional `description`/`tags`).
- Parameters/commands/privateCallbacks/assets/outputs live in the Tool Entry named maps; map keys are stable IDs.
- Framework Libraries are declared in `manifest.libraries` and supplied by the Forge Profile — never bundled by the tool.

## Styling And UI

- Do not introduce Tailwind. Use CSS Custom Properties and `px` units.
- Keep shared UI copy in English.
- The Container realm has no Host `app.css`: provide token fallbacks (`var(--token, fallback)`) or plain px values.
- Keep Bits UI prop forwarding intact when touching host-side wrapped interactive primitives (`src/lib/components/ui/`).
