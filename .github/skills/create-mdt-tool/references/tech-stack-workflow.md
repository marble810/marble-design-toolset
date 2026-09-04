# Tech Stack Workflow

Framework Libraries (`three`, `pixi`, `gsap`, `vgpu`) are supplied by the Forge Profile through the container import map — tools never bundle their own copies.

## Declaring

1. Add the library id to `manifest.json` → `"libraries": ["three"]` (validated against the supported set).
2. Import it bare in tool-private modules: `import * as THREE from 'three'`. Declared libraries (and their subpaths) are kept external by the builder, so the import resolves through the container import map at runtime.
3. Keep the import out of `index.ts` when possible: the Forge extraction worker evaluates the Tool Entry and must not need GPU libraries. Load heavy modules lazily (`await import('./sim/export-replay.ts')`) inside callbacks that need them — see `tools/shallow-water/outputs.ts`.

## Using In The Canvas

- The Canvas owns the WebGL/Pixi context and the rAF loop. Create renderers on mount and dispose on unmount.
- Do not pass GPU objects across the Environment API; only small control messages (parameter changes, surface resize) cross it.
- Simulation stepping must be deterministic where exports replay it: drive export rendering from integer step counts, not wall-clock time (see `tools/shallow-water/sim/export-replay.ts`).

## Verification

- `bun run forge:web-catalog` must list the library under the entry's `libraries` and bundle it into the release `libs/` (check the `[forge] supplied Framework Library` log lines).
- Open the tool on `/` and confirm the canvas boots in the container (the import map only supplies libraries inside `container.html`).
