## ADDED Requirements

### Requirement: Tool IO facade exposes named source slot workflows
Tool IO SHALL expose a source slot workflow that is backed by the file-input pipeline and can represent one or more named slots. Each slot declaration MUST support a stable `id`, English `name`, English `desc`, `allowedKinds`, `required`, `accept`, and `maxSizeMB`.

#### Scenario: Tool creates a multi-slot source workflow
- **WHEN** a tool creates a source workflow with `hero` and `logo` slot declarations
- **THEN** the workflow exposes independent slot state and actions for `hero` and `logo` while still using the shared file-input validation and read path

#### Scenario: Tool declares a max size for a slot
- **WHEN** a user imports a file larger than the slot's configured `maxSizeMB`
- **THEN** the workflow exposes a stable slot-specific error and does not replace that slot's previous successful item

### Requirement: SourceInputSection automatically supports single-slot and multi-slot workflows
SourceInputSection SHALL detect whether the provided source workflow represents a single slot or multiple slots. For a single slot it MUST preserve the existing UI behavior. For multiple slots it MUST render one input section per slot or an equivalent slot list that displays the slot name, description, busy state, current item summary, error state, Browse/Replace, and Clear actions.

#### Scenario: Existing single source workflow is rendered
- **WHEN** a tool passes an existing single source workflow to SourceInputSection
- **THEN** SourceInputSection renders the same single-input UI behavior as before

#### Scenario: Multi-slot workflow is rendered
- **WHEN** a tool passes a source workflow with multiple slots to SourceInputSection
- **THEN** SourceInputSection renders controls for each slot using each slot's English `name` and `desc`

### Requirement: DropZone supports slot-aware ingest
DropZone SHALL support binding to a specific source slot when a workflow contains multiple slots. Drop handling MUST still route through the same source workflow ingest path used by picker input.

#### Scenario: User drops a file onto a slot-bound DropZone
- **WHEN** a DropZone is bound to the `hero` slot and the user drops a supported image file
- **THEN** the workflow ingests the file into the `hero` slot and does not alter other slots

#### Scenario: User drops an unsupported file onto a slot-bound DropZone
- **WHEN** a DropZone is bound to the `logo` slot and the dropped file violates that slot's allowed kinds
- **THEN** the `logo` slot receives the stable error from file-input pipeline and other slots remain unchanged

### Requirement: Tool IO summaries include font items
Tool IO SHALL extend reusable file summaries to include font imported items. Font summaries MUST expose stable display fields suitable for SourceInputSection without requiring layout tools to inspect raw File objects.

#### Scenario: SourceInputSection displays uploaded font
- **WHEN** a font slot contains a successful imported font item
- **THEN** SourceInputSection displays the font file name, size, and kind summary consistently with other source item summaries
