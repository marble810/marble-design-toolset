## ADDED Requirements

### Requirement: DOM PNG export uses html-to-image internally
Framework SHALL implement `kind: 'dom'` PNG export using `html-to-image` or an equivalent DOM capture adapter that preserves computed styles, CSS variables, fonts, and images more reliably than a raw DOM clone. The dependency MUST be hidden behind the framework export runtime and MUST NOT require tool authors to import `html-to-image` directly.

#### Scenario: DOM exporter is exported as PNG
- **WHEN** the active exporter has `kind: 'dom'` and the user starts PNG export
- **THEN** the framework captures the exporter element through the DOM capture adapter and downloads a PNG using the existing Export panel task flow

#### Scenario: Tool does not import DOM capture library
- **WHEN** a layout tool registers a DOM exporter through the framework or layout controller
- **THEN** the tool only provides an element getter and dimensions, and the framework owns the DOM capture implementation

### Requirement: DOM export supports framework-defined safe options
DOM exporters SHALL support a framework-defined set of safe DOM export options: `backgroundColor`, `filter`, `cacheBust`, and `style` overrides. Framework MUST map these options to the internal DOM capture adapter and MUST NOT expose a full third-party options passthrough as the stable tool API.

#### Scenario: Tool excludes editing overlays
- **WHEN** a DOM exporter provides a `filter` option that excludes helper nodes
- **THEN** the PNG export omits those nodes while preserving the rest of the layout DOM

#### Scenario: Tool sets export background
- **WHEN** a DOM exporter provides a `backgroundColor`
- **THEN** the exported PNG uses that background color according to framework DOM export behavior

### Requirement: DOM export preserves Export panel scale and content size semantics
DOM PNG export SHALL continue to honor the existing Export panel scale choices and exporter `contentWidth` / `contentHeight`. The output PNG pixel size MUST equal `contentWidth × scale` by `contentHeight × scale`.

#### Scenario: User exports DOM layout at 4x
- **WHEN** a DOM exporter reports `contentWidth = 1080` and `contentHeight = 1080`, and the user selects scale `4`
- **THEN** the downloaded PNG is `4320 × 4320` pixels

### Requirement: DOM export can surface warnings
DOM export SHALL support warning diagnostics for recoverable degradation such as font fallback. Warnings MUST be visible through framework export result or diagnostics UI without treating the export as a successful silent match.

#### Scenario: Font fallback occurs during DOM export
- **WHEN** a layout controller reports that a requested Google Font fell back to a system font
- **THEN** the Export panel can display a warning while still allowing PNG export
