## ADDED Requirements

### Requirement: File input pipeline supports font files
Framework SHALL extend the file input pipeline with a `font` kind. Font items MUST be normalized into the shared imported item shape with `kind`, `source`, `file`, `name`, `mimeType`, `size`, and `lastModified`, and MUST additionally expose enough binary or object URL access for font registration without requiring tools to re-read the original File independently.

#### Scenario: Font file import succeeds
- **WHEN** a controller that allows `font` receives a supported `.ttf`, `.otf`, `.woff`, or `.woff2` file
- **THEN** the pipeline returns a normalized `kind = font` imported item that can be consumed by layout font helpers

#### Scenario: Unsupported font file is rejected
- **WHEN** a controller that allows `font` receives a file whose type or extension is not recognized as a supported font format
- **THEN** the pipeline returns a stable unsupported-kind error and preserves the previous successful item for that input

### Requirement: File input pipeline supports named input slots
Framework SHALL support a source slot collection model in addition to the existing single-item controller behavior. Each slot MUST have a stable id and independent current item, busy state, last error, clear action, ingest action, and cleanup lifecycle.

#### Scenario: Multiple slots ingest independently
- **WHEN** a source collection declares `hero` and `logo` slots and the user imports a file into `hero`
- **THEN** only the `hero` slot state changes, and the `logo` slot state remains unchanged

#### Scenario: Slot-specific validation fails
- **WHEN** the user imports a file that violates the allowed kinds or max size of one slot
- **THEN** only that slot receives the stable error, and other slots keep their current successful items

#### Scenario: Collection is disposed
- **WHEN** a source slot collection is disposed
- **THEN** the framework releases every object URL or temporary resource owned by every slot in the collection

### Requirement: Single-input behavior remains backward compatible
Existing single-item file input controllers SHALL remain available and MUST preserve current semantics for image, video, and text tools. A single-slot collection MAY be used internally, but public behavior for existing tool code MUST remain compatible.

#### Scenario: Existing source workflow imports one image
- **WHEN** an existing tool creates the current single source workflow and imports one image
- **THEN** the tool can still read `currentItem`, `lastError`, `busy`, `pick`, `clear`, and `dispose` with the same behavior as before

#### Scenario: Existing single-item controller receives multiple files
- **WHEN** an existing single-item controller receives multiple files in one ingest operation
- **THEN** it continues to treat the operation as a failure and preserves the previous successful item
