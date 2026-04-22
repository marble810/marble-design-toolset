# Framework Constraints

Read this first. These are hard constraints for every tool.

## Layout And Ownership

- The workspace shell is framework-owned.
- A tool may only render its own left-side content and right-side content.
- Do not recreate the top-level workspace shell, header, tabs, settings, help, or about dialog inside a tool.
- `LeftPanel` already renders `MainInfo` at the top. Do not duplicate tool title and description there.

## File Schema

- Every tool lives in `src/tools/<tool-id>/`.
- `tool-id` must be kebab-case.
- The tool root must contain `metadata.json`, `index.ts`, and exactly one root-level master `.svelte`.
- The master component filename must be the PascalCase form of `tool-id`.
- Every other private `.svelte` component must live under `components/`.

## Metadata And Runtime

- `metadata.json` is static-only.
- Put only static metadata there, such as `name`, `desc`, `tag`, `version`, optional `enabled`, and optional `export`.
- Do not put `techStack`, `loadComponent`, component paths, or state defaults in `metadata.json`.
- `index.ts` owns runtime definition and lazy component loading.
- Declare `techStack` only in `index.ts`.

## Styling And UI

- Do not use Tailwind.
- Use CSS Custom Properties and `px` units.
- Shared UI copy must be English.
- The app is landscape-only. The framework handles the sub-720px blocking state.
- Interactive base components should be based on Bits UI wrappers.
- Layout components must be hand-written, not Bits UI.

## Bits UI Prop Forwarding

- When using a Bits UI `child` snippet, forward `{...props}` to the delegated element.
- For floating content, preserve the outer `{...wrapperProps}` and inner `{...props}` structure.
- Do not put visual styling on the wrapper element used only for positioning.

## Heavy Dependencies

- `three`, `pixi`, and `gsap` are optional heavy stacks.
- Load them through the shared runtime.
- Do not directly couple heavy dependencies into the common shell.

## Local File Inputs

- When a tool imports local image, video, or text files, use the shared `src/lib/runtime/file-input/` runtime.
- Do not reimplement separate file-kind detection, drop parsing, or object URL cleanup inside each tool.

## Documentation Language

- OpenSpec artifacts must be written in Chinese.
- Developer docs under `docs/` must be written in Chinese.
