## ADDED Requirements

### Requirement: 工具提供 Perlin 与 Voronoi 两种可切换噪声族
noise texture tool SHALL allow the user to select exactly one active noise family at a time from Perlin Noise and Voronoi Noise. The tool SHALL regenerate the preview whenever the active family changes, and SHALL NOT expose a third noise family in this change.

#### Scenario: 工具打开时存在受支持的默认噪声族
- **WHEN** the user opens the noise texture tool
- **THEN** one supported noise family is already active and the preview shows generated output for that family

#### Scenario: 用户切换到另一种受支持的噪声族
- **WHEN** the user selects the other supported noise family
- **THEN** the tool makes that family active and regenerates the preview using that family's parameters

### Requirement: 工具渲染固定 512px 的 1:1 方形预览
The noise texture tool SHALL generate a 512px by 512px output texture and SHALL display it inside the existing PreviewCanvas without changing the configured preview content size. The generated output MUST preserve a 1:1 aspect ratio for every supported noise family and parameter state.

#### Scenario: 工具渲染初始预览
- **WHEN** the tool mounts in the workspace shell
- **THEN** the preview content area remains 512 pixels wide and 512 pixels high and displays square noise output

#### Scenario: 重新生成后预览仍保持方形
- **WHEN** the user changes any supported parameter or switches to another supported noise family
- **THEN** the regenerated output still uses a 512px by 512px texture and remains a 1:1 square preview

### Requirement: 工具暴露共享参数与噪声族专属参数控制
The noise texture tool SHALL provide a shared parameter group containing seed, overall scale, horizontal offset, vertical offset, brightness, and contrast. The tool SHALL also provide family-specific parameter groups: Perlin Noise MUST expose octave count, persistence, lacunarity, and exponent controls; Voronoi Noise MUST expose cell density, jitter, edge width, edge softness, point radius, point sharpness, fill strength, and cell variation controls.

#### Scenario: 用户调整共享参数
- **WHEN** the user changes a shared parameter while a noise family is active
- **THEN** the tool regenerates the preview using the updated shared parameter value

#### Scenario: 用户选择 Perlin Noise
- **WHEN** the active noise family is Perlin Noise
- **THEN** the tool shows the Perlin-specific controls and uses them for preview generation

#### Scenario: 用户选择 Voronoi Noise
- **WHEN** the active noise family is Voronoi Noise
- **THEN** the tool shows the Voronoi-specific controls and uses them for preview generation

#### Scenario: 用户快速切换 Voronoi 预设
- **WHEN** the active noise family is Voronoi Noise and the user applies a Voronoi preset
- **THEN** the tool updates the Voronoi parameter group to that preset's values and regenerates the preview immediately

### Requirement: 工具仅支持 PNG 图片导出并覆盖 8-bit 与 16-bit
The noise texture tool SHALL declare image export capability only. It MUST NOT expose video export for this change. The tool SHALL allow the current 512px by 512px output to be exported as PNG with both 8-bit and 16-bit bit depth options through the framework-owned Export Section.

#### Scenario: 工具只暴露图片导出入口
- **WHEN** the user opens the Export Section for the noise texture tool
- **THEN** the section exposes image export controls only and does not show a video tab or video form

#### Scenario: 用户导出 8-bit PNG
- **WHEN** the user selects 8-bit PNG export and confirms
- **THEN** the tool exports the current square noise output as a PNG image through the framework export flow

#### Scenario: 用户导出 16-bit PNG
- **WHEN** the user selects 16-bit PNG export and confirms
- **THEN** the tool exports the current square noise output as a 16-bit PNG image through the framework export flow

### Requirement: 工具实现分离噪声族代码并通过共享 Preview 模块输出
The noise texture tool implementation SHALL keep Perlin Noise and Voronoi Noise generation logic in separate TypeScript modules. It SHALL route the currently selected family output through one shared Pixi-backed preview component, and the master Svelte entry SHALL compose that shared preview component instead of embedding family-specific rendering code directly.

#### Scenario: 贡献者检查噪声实现结构
- **WHEN** the contributor inspects the tool source layout
- **THEN** Perlin and Voronoi generation logic live in separate TypeScript modules and are not merged into one monolithic noise file

#### Scenario: 主入口组件组织预览输出
- **WHEN** the master Svelte component renders the tool
- **THEN** it delegates preview rendering to one shared preview component that owns the Pixi-backed output path