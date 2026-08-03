## 1. Flow parameter model and controls

- [x] 1.1 Extend `ShallowWaterParameters` defaults and normalization with Flow X/Y plus Distort Strength, Scale, and Speed using conservative finite ranges.
- [x] 1.2 Add English Flow and Distort sliders to the existing Simulation controls and ensure Reset Parameters restores zero flow/distortion.

## 2. GPU flow advection

- [x] 2.1 Add base flow and deterministic curl-style Distort uniforms/functions to the compute shader.
- [x] 2.2 Backtrace the current state and Laplacian neighborhood through the combined velocity field while advecting both stored height time layers.
- [x] 2.3 Enable continuous compute-state sampling, clamp backtraced coordinates, and preserve existing damping, edge absorption, height clamp, and rest threshold behavior.
- [x] 2.4 Track deterministic simulation-step phase and reset it with initial height data so preview and export replay the same Distort field.

## 3. Verification

- [x] 3.1 Add the smallest focused runnable check for new parameter normalization and deterministic step/reset behavior that can be tested outside WebGL.
- [ ] 3.2 Verify in a real WebGL preview that zero Flow/Distort preserves existing propagation and nonzero values move and perturb waves without invalid numerical output.
- [x] 3.3 Run the relevant tests and `npm run build`, then resolve regressions introduced by this change.
