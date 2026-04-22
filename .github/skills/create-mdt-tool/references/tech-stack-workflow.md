# Tech Stack Workflow

Read this only when the tool needs `three`, `pixi`, or `gsap`.

## General Rule

- Declare heavy stacks in `index.ts` using `techStack`.
- Load them through the shared runtime.
- Keep the common shell free from direct heavy-library coupling.

## Pixi

Before coding with Pixi, read:

- `docs/guides/Making Tools/tool-pixi-guide.md`

Use Pixi when the tool is fundamentally 2D-renderer-driven and benefits from an explicit scene graph or texture workflow.

Checklist:

- initialize Pixi in a private component under `components/`
- mount and destroy the application cleanly
- keep parameter updates deterministic
- use `PreviewCanvas` or `FullStage` according to the tool's stage model

## Three

Before coding with Three, read:

- `docs/guides/Making Tools/tool-threejs-guide.md`

Use Three when the tool is truly 3D or WebGL-scene-driven.

Checklist:

- create and dispose renderer, scene resources, and observers cleanly
- keep render loop ownership explicit
- choose `FullStage` unless a fixed-size preview model is clearly better

## GSAP

Use GSAP only when animation requirements are strong enough to justify it.

Checklist:

- declare `gsap` in `index.ts`
- keep animation ownership local to the tool
- clean up timelines or tickers on destroy
