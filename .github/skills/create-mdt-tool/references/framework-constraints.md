# Framework Constraints

Read this first. These are hard constraints for every Tool Project.

## Ownership

- Deshelf Host owns: top-level layout, Standard Inspector, Parameter Store (validation + computed scheduling), Session lifecycle, Asset selection, Export orchestration.
- The Tool owns: Canvas pixels, rAF loop, GPU/simulation state, Tool Entry callback implementations. These hot paths stay inside the Tool Container and never cross the Environment API.
- Do not render LeftPanel/RightPanel or re-create the workspace shell inside a tool. Inspector controls come from the build-time-extracted tree.

## File Schema

- Every tool lives in `tools/<slug>/` (convention root scanned by the Forge build).
- `slug` must be kebab-case and globally unique.
- The tool root must contain exactly two registration points: `manifest.json` and `index.ts`.
- `index.ts` has exactly one `export default defineVisualTool(...)` and no top-level side effects.
- Additional files (`parameters.ts`, `inspector.ts`, `outputs.ts`, `assets.ts`, `commands.ts`, `callbacks.ts`, `sim/`, `canvas/`, `slate/`) are private organization only — never a second registration entry.
- Canvas and Tool Slate must be dynamic imports (`() => import('./canvas/Canvas.svelte')`).

## Manifest

- `manifest.json` is a closed schema: `contractVersion`, `projectId` (immutable UUID), `slug`, `name`, optional `description`/`tags`, `version` (semver), `forgeProfile`, `libraries`.
- Never add `entry`, parameters, commands, inspector, capability, slate, export, or `enabled` to the Manifest.

## Parameters And Inspector

- Parameters are a flat named map in the Tool Entry; constraints make the Host Store the validity authority (out-of-range writes are rejected, not clamped).
- `computed` parameters need `compute` (pure, no GPU/IO) + `dependsOn`.
- Inspector bindings accept typed handles only; inline anonymous callbacks fail extraction.
- Conditional relevance uses `visibleWhen` (host-evaluated against live store values); the tree itself is static in the Catalog.

## Styling And UI

- Do not use Tailwind. Use CSS Custom Properties and `px` units.
- Shared UI copy must be English. The app is landscape-only.
- The Container realm has no Host `app.css`: give shared design tokens a fallback (`var(--token, fallback)`) or write px values.
- Svelte `<script lang="ts">` supports TS syntax only (type annotations); no preprocess-only features.

## Heavy Dependencies

- `three`, `pixi`, `gsap`, `vgpu` are Forge Profile-supplied Framework Libraries.
- Declare them in `manifest.libraries` and import bare (`import * as THREE from 'three'`); the container import map supplies one shared runtime instance.
- Tools never bundle their own `node_modules`, third-party packages, or Vite/Svelte config.

## Asset And Export

- Asset Inputs are typed slots in the Tool Entry `assets` map; the Host owns the picker and content lifecycle. Real file paths never enter the tool (Web: blob URL; Desktop: `deshelf-cache://` opaque URL).
- Visual Outputs are declared in the `outputs` map; the render/encode callback stays in the Main artifact. Registering an exporter after Canvas mount is forbidden.

## Documentation Language

- OpenSpec artifacts must be written in Chinese.
- Developer docs under `docs/` must be written in Chinese.
