## 1. Tool Skeleton

- [x] 1.1 Create `src/tools/shallow-water-height/` with `metadata.json`, `index.ts`, one root master Svelte component, and private `components/` files.
- [x] 1.2 Configure metadata with English copy, enabled state, tags, version, and image/video export capability.
- [x] 1.3 Configure runtime definition with `techStack: ['three']` and lazy master component loading.

## 2. Input And Controls

- [x] 2.1 Use the shared file input controller for single image picker/drop ingest and error display.
- [x] 2.2 Add controls for simulation resolution, amplitude, wave speed, damping, edge absorb width, steps per frame, contrast, and invert mode.
- [x] 2.3 Reset or rebuild the simulation when the init map or structural parameters change.

## 3. Simulation And Preview

- [x] 3.1 Implement a Three.js-backed fixed-size preview renderer that maps the init image to a height texture.
- [x] 3.2 Implement damped linear wave propagation with ping-pong state textures.
- [x] 3.3 Apply an absorbing edge mask so waves dissipate at canvas boundaries without reflection.
- [x] 3.4 Render the current height field as a black-and-white raster preview inside PreviewCanvas.

## 4. Export Integration

- [x] 4.1 Register a `render` canvas exporter during component initialization and unregister it on cleanup.
- [x] 4.2 Render deterministic PNG frames from the init map and current parameters.
- [x] 4.3 Render deterministic video frames by advancing fixed simulation steps from the init map by `frameIndex`.

## 5. Validation

- [x] 5.1 Run the narrowest relevant checks for changed files or generated tool structure.
- [x] 5.2 Run `npm run build` and address issues caused by this change.