## ADDED Requirements

### Requirement: Framework exposes a headless layout tool controller
Framework SHALL expose `createLayoutToolController` from `$lib/tool-sdk/index.js` as the public entry for layout-template tools. The controller MUST accept explicit `size`, `sources`, `fonts`, and `export` configuration sections, and MUST return headless state and actions without rendering mandatory UI components.

#### Scenario: Layout tool creates a controller
- **WHEN** a tool imports `createLayoutToolController` from `$lib/tool-sdk/index.js` and provides valid `size`, `sources`, `fonts`, and `export` sections
- **THEN** the returned controller exposes reactive size state, source slot state, font state, export registration lifecycle, diagnostics, and dispose actions without requiring a framework-provided control component

#### Scenario: Layout tool owns its UI
- **WHEN** a layout tool renders its LeftPanel controls and PreviewCanvas content
- **THEN** the controller supplies state and actions only, and the tool remains responsible for its Svelte markup, CSS, field arrangement, and preview DOM structure

### Requirement: Layout controller manages dynamic canvas size with hard bounds
The layout controller SHALL manage canvas width and height as user-editable pixel values. Tool developers MUST be able to configure default, minimum, and maximum width and height. The controller MUST reject or clamp invalid values according to its stable validation state, and MUST NOT require step-based size normalization in the first version.

#### Scenario: User enters an in-range custom size
- **WHEN** the user enters a width and height within the configured min and max bounds
- **THEN** the controller exposes those dimensions as the active layout `contentWidth` and `contentHeight`

#### Scenario: User enters an out-of-range size
- **WHEN** the user enters a width or height outside the configured min and max bounds
- **THEN** the controller exposes a stable validation state and prevents exported dimensions from exceeding the configured bounds

#### Scenario: Tool uses PreviewCanvas
- **WHEN** the tool passes controller size values to `PreviewCanvas`
- **THEN** PreviewCanvas receives reactive `contentWidth` and `contentHeight` values and renders the layout root at the selected logical pixel dimensions

### Requirement: Layout controller integrates named source slots
The layout controller SHALL consume source slot declarations and expose each slot by stable id. Each slot MUST support at least `id`, English `name`, English `desc`, `allowedKinds`, `required`, `accept`, and `maxSizeMB` configuration through the underlying tool IO capability.

#### Scenario: Template declares multiple image slots
- **WHEN** a layout tool declares source slots such as `hero`, `logo`, and `avatar`
- **THEN** the controller exposes independent state, ingest actions, errors, and clear actions for each slot

#### Scenario: Required source slot is empty
- **WHEN** a required slot has no successful input item
- **THEN** the controller exposes a diagnostic that the tool can show in its UI or that export registration can surface as a warning or disabled state according to the export configuration

### Requirement: Layout controller manages Google Fonts and uploaded fonts
The layout controller SHALL provide a font controller that supports Google Fonts family loading and user-uploaded font files. It MUST normalize both sources into font-face CSS or equivalent browser font registration state that can be used by the preview DOM and DOM export pipeline.

#### Scenario: Google Font loads successfully
- **WHEN** the user or tool requests a Google Font family and the remote CSS and font file fetches succeed
- **THEN** the controller registers the font for preview use and provides export-ready font CSS for DOM PNG export

#### Scenario: Google Font fails to load
- **WHEN** a requested Google Font family cannot be fetched or parsed
- **THEN** the controller falls back to the configured system font stack and exposes a warning instead of silently reporting success

#### Scenario: User uploads a font file
- **WHEN** the user imports a supported font file through a font source slot
- **THEN** the controller registers the uploaded font for preview use and provides export-ready font CSS for DOM PNG export

### Requirement: Layout controller registers DOM PNG export through framework export runtime
The layout controller SHALL register a framework canvas exporter for the layout DOM root rather than triggering downloads itself. The registered exporter MUST use `kind: 'dom'`, reactive content dimensions, and framework-owned PNG export behavior.

#### Scenario: Layout tool registers export root
- **WHEN** the tool provides a DOM element getter and active canvas dimensions through the layout controller export section
- **THEN** the framework Export panel can export that DOM root as PNG using the standard filename, scale, busy state, and result UI

#### Scenario: Tool unmounts
- **WHEN** the layout tool component is destroyed
- **THEN** the controller unregisters the DOM exporter and disposes source and font resources owned by the controller

### Requirement: Layout controller exposes diagnostics without hiding recoverable degradation
The layout controller SHALL expose diagnostics for invalid size input, missing required source slots, failed font loading, and DOM export readiness. Recoverable font failures MUST be represented as warnings rather than silent fallbacks.

#### Scenario: Export proceeds with system font fallback
- **WHEN** a Google Font fails and the controller falls back to a system font
- **THEN** the controller exposes a warning that the Export panel or tool UI can display while still allowing PNG export

#### Scenario: Export root is missing
- **WHEN** no DOM export root is available
- **THEN** the controller exposes an export readiness diagnostic and the framework exporter cannot run successfully
