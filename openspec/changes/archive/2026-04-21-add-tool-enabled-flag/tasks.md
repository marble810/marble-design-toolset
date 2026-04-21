## 1. Runtime contract updates

- [x] 1.1 Extend the tool metadata type to support an optional enabled boolean with default-true compatibility.
- [x] 1.2 Update tool registry catalog construction so disabled tools are excluded from the catalog and valid tool ID set during metadata discovery.

## 2. Workspace behavior alignment

- [x] 2.1 Ensure hash-based activation and persisted workspace state restoration both reject tools that are disabled by metadata.
- [x] 2.2 Add or update focused coverage for catalog filtering and disabled-tool restore behavior.

## 3. Tool metadata and documentation

- [x] 3.1 Add an explicit enabled field to existing tool metadata files, preserving current tools as enabled.
- [x] 3.2 Update the tool authoring guide and related runtime documentation to define enabled as a hard availability switch.