## 1. Tool structure and state model

- [ ] 1.1 Replace the starter content in NoiseTextureCreater.svelte with real shell composition, English UI copy, and a shared active-noise state.
- [ ] 1.2 Add private UI components for the controls panel and preview host under components/, and define shared plus family-specific TypeScript parameter types and defaults.
- [ ] 1.3 Remove the incomplete direct Pixi bootstrapping from the root component and route Pixi lifecycle ownership through the dedicated preview component.

## 2. Noise generation pipeline

- [ ] 2.1 Implement a shared noise controller that normalizes tool state, generates a reusable 512x512 pixel buffer, and hands preview-ready data to the Pixi layer.
- [ ] 2.2 Implement a seamless Perlin noise module with octave count, persistence, lacunarity, and exponent controls.
- [ ] 2.3 Implement a seamless Voronoi noise module with cell density, jitter, edge width, and edge softness controls.
- [ ] 2.4 Implement a seamless Alligator noise module with scale density, warp strength, ridge width, and crack contrast controls.

## 3. Preview and interaction integration

- [ ] 3.1 Build the left-panel controls for noise family switching, shared parameters, and family-specific parameter sections.
- [ ] 3.2 Build the Pixi-backed preview component so regenerated buffers are uploaded into a fixed 512x512 square texture inside PreviewCanvas.
- [ ] 3.3 Wire parameter changes and family switches to immediate preview regeneration while preserving the existing PreviewCanvas navigation behavior and 1:1 square output.

## 4. Verification

- [ ] 4.1 Add or update focused tests for noise parameter typing, helper logic, or tool integration where practical.
- [ ] 4.2 Run npm run build and resolve any tool-specific compile or type errors introduced by the implementation.
- [ ] 4.3 Manually verify Perlin, Voronoi, and Alligator previews, each control group, and seamless tiling behavior at the texture edges.