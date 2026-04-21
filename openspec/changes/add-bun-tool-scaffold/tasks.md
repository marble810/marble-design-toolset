## 1. Scaffold entry and command wiring

- [x] 1.1 Add a repository-local Bun scaffold entrypoint and expose it through a package script for creating new tools.
- [x] 1.2 Implement prompt collection and name normalization so the command derives tool-id, display name, and master component name from the user input.
- [x] 1.3 Reject invalid or conflicting target directories before any files are written.

## 2. Template generation

- [x] 2.1 Add scaffold templates or template resources for the shared files required by every tool: metadata.json, index.ts, and the root master Svelte component.
- [x] 2.2 Implement starter-specific output for preview and stage modes so generated tools use the correct framework-owned right-panel container.
- [x] 2.3 Write tech stack selections into runtime definition output only, preserving static-only metadata generation.

## 3. Documentation and verification

- [x] 3.1 Update README and tool authoring documentation to describe the new scaffold command, its prompts, and the generated starter types.
- [x] 3.2 Add focused validation for name normalization, tech stack emission, and existing-directory collision handling.
- [x] 3.3 Verify the scaffold by generating a sample tool and confirming the repository still passes its standard build checks.