## 1. Tool structure and state model

- [x] 1.1 Create the noise-texture-creater tool shell with real LeftPanel / RightPanel composition, English UI copy, and a shared active-noise state.
- [x] 1.2 Add private UI components for the controls panel and shared preview host under components/, and define shared plus family-specific TypeScript parameter types and defaults.
- [x] 1.3 Keep Pixi lifecycle ownership inside the dedicated preview component and route image export registration through that component.

## 2. Noise generation pipeline

- [x] 2.1 Implement a shared noise controller that normalizes tool state, generates a reusable 512x512 pixel buffer, and hands preview-ready data to the Pixi layer.
- [x] 2.2 Implement a Perlin noise module with octave count, persistence, lacunarity, and exponent controls.
- [x] 2.3 Implement a Voronoi noise module with cell density, jitter, edge width, edge softness, and additional shape controls for point radius, point sharpness, fill strength, and cell variation.

## 3. Preview and export integration

- [x] 3.1 Build the left-panel controls for noise family switching, shared parameters, family-specific parameter sections, and quick Voronoi presets.
- [x] 3.2 Build the Pixi-backed shared preview component so regenerated buffers are uploaded into a fixed 512x512 square texture inside PreviewCanvas.
- [x] 3.3 Register image export support so the tool exposes PNG output only, with both 8-bit and 16-bit paths available through the framework Export Section.

## 4. Verification

- [x] 4.1 Add or update focused tests for noise parameter typing, helper logic, or export-related controller behavior where practical.
- [x] 4.2 Run npm run build and resolve any tool-specific compile or type errors introduced by the implementation.
- [x] 4.3 Manually verify Perlin and Voronoi previews, each parameter group, square 512x512 output, and both PNG export bit depths.