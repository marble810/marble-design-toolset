## ADDED Requirements

### Requirement: Tool scaffolding provides a layout-template recipe
The tool scaffolding command SHALL provide a `layout-template` recipe for creating layout-template tools. The generated output MUST conform to the existing tool module schema and MUST not create a custom workspace shell.

#### Scenario: Developer selects layout-template recipe
- **WHEN** a developer runs the tool scaffolding command and selects `layout-template`
- **THEN** the command generates `src/tools/<tool-id>/metadata.json`, `index.ts`, one root-level PascalCase Svelte master component, and private child components under `components/`

#### Scenario: Generated layout tool uses framework shell components
- **WHEN** the layout-template recipe generates the master component
- **THEN** the generated component uses `LeftPanel`, `RightPanel`, and `PreviewCanvas` rather than redefining the top-level workspace shell

### Requirement: Layout-template recipe demonstrates the full layout controller workflow
The `layout-template` recipe SHALL generate a complete runnable example that wires dynamic canvas size, multiple source slots, Google Font loading, uploaded font input, and DOM PNG export through `createLayoutToolController`.

#### Scenario: Generated starter is opened in workspace
- **WHEN** the generated layout-template tool is opened
- **THEN** it renders editable controls, a DOM layout preview, and a registered PNG exporter through framework export UI

#### Scenario: Generated starter declares export metadata
- **WHEN** the layout-template recipe writes `metadata.json`
- **THEN** the metadata includes image export capability without embedding runtime-only controller or tech stack configuration

### Requirement: Layout-template recipe avoids heavy tech stack declarations
The `layout-template` recipe SHALL be based on Svelte and DOM rendering only. It MUST NOT declare `three`, `pixi`, or `gsap` unless the developer explicitly chooses an additional supported tech stack outside the default recipe.

#### Scenario: Developer accepts default layout-template recipe
- **WHEN** the developer creates a layout-template tool without extra tech stack selection
- **THEN** the generated `index.ts` does not include `techStack` for `three`, `pixi`, or `gsap`

### Requirement: Layout-template documentation is generated or linked for tool authors
The scaffolding workflow SHALL direct tool authors to the layout-tool documentation under `docs/for-tool-developers/`. Generated code MAY include concise comments only where needed, but MUST NOT rely on comments as the primary documentation.

#### Scenario: Developer creates a layout-template starter
- **WHEN** the scaffolding command completes successfully
- **THEN** the command output or generated README guidance points the developer to the layout-tool documentation in `docs/for-tool-developers/`
