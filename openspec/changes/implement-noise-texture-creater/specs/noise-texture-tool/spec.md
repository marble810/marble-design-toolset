## ADDED Requirements

### Requirement: Tool offers switchable noise families
The noise texture tool SHALL allow the user to select exactly one active noise family at a time from Perlin Noise, Voronoi Noise, and Alligator Noise. The tool SHALL regenerate the preview whenever the active family changes.

#### Scenario: Tool opens with a supported default family
- **WHEN** the user opens the noise texture tool
- **THEN** one supported noise family is already active and the preview shows generated output for that family

#### Scenario: User switches to another noise family
- **WHEN** the user selects a different supported noise family
- **THEN** the tool makes that family active and regenerates the preview using that family's parameters

### Requirement: Tool renders a fixed square preview
The noise texture tool SHALL generate a 512px by 512px output texture and SHALL display it inside the existing PreviewCanvas without changing the configured preview content size. The generated output MUST preserve a 1:1 aspect ratio for every supported noise family and parameter state.

#### Scenario: Tool renders its initial preview
- **WHEN** the tool mounts in the workspace shell
- **THEN** the preview content area remains 512 pixels wide and 512 pixels high and displays square noise output

#### Scenario: Preview remains square after regeneration
- **WHEN** the user changes any supported parameter or switches to another noise family
- **THEN** the regenerated output still uses a 512px by 512px texture and remains a 1:1 square preview

### Requirement: Tool exposes shared and family-specific parameter controls
The noise texture tool SHALL provide a shared parameter group containing seed, overall scale, horizontal offset, vertical offset, brightness, contrast, and a seamless toggle. The tool SHALL also provide family-specific parameter groups: Perlin Noise MUST expose octave count, persistence, lacunarity, and exponent controls; Voronoi Noise MUST expose cell density, jitter, edge width, and edge softness controls; Alligator Noise MUST expose scale density, warp strength, ridge width, and crack contrast controls.

#### Scenario: User adjusts shared controls
- **WHEN** the user changes a shared parameter while a noise family is active
- **THEN** the tool regenerates the preview using the updated shared parameter value

#### Scenario: User selects Perlin Noise
- **WHEN** the active noise family is Perlin Noise
- **THEN** the tool shows the Perlin-specific controls and uses them for preview generation

#### Scenario: User selects Voronoi Noise
- **WHEN** the active noise family is Voronoi Noise
- **THEN** the tool shows the Voronoi-specific controls and uses them for preview generation

#### Scenario: User selects Alligator Noise
- **WHEN** the active noise family is Alligator Noise
- **THEN** the tool shows the Alligator-specific controls and uses them for preview generation

### Requirement: Tool supports seamless tiling for every noise family
When seamless mode is enabled, the noise texture tool SHALL generate outputs whose left and right edges align and whose top and bottom edges align for Perlin Noise, Voronoi Noise, and Alligator Noise.

#### Scenario: User enables seamless mode
- **WHEN** the user enables seamless mode for the current noise family
- **THEN** the regenerated output can tile horizontally and vertically without visible edge discontinuities

#### Scenario: User keeps seamless mode enabled while switching families
- **WHEN** seamless mode remains enabled and the user switches to another supported noise family
- **THEN** the regenerated output for the new family remains tileable on both axes