# Modify Workflow

Follow this sequence for changes to an existing tool.

## 1. Start From The Controlling Surface

- Begin with the tool's root folder.
- Step to the nearest component, runtime file, or helper that directly controls the requested behavior.
- Do not start with broad repo exploration unless the controlling path is genuinely unclear.

## 2. Confirm The Current Tool Contract

Confirm:

- current right-panel mode
- current export capability, if any
- current heavy stack declaration, if any
- whether the existing file layout already violates the schema

## 3. State The Intended Change

Before editing, decide whether the change is:

- behavior-only
- structural modification
- right-panel mode change
- export integration or repair
- heavy stack addition or cleanup

Use the smallest change category that fits.

## 4. Edit Locally First

- Prefer the smallest local edit that tests the hypothesis.
- Only split components or move files when the current structure clearly blocks the change.
- Preserve stable contracts unless the request requires a structural change.

## 5. Re-check Boundaries After Modification

After editing, verify:

- the tool still sits cleanly inside framework shell boundaries
- `metadata.json` is still static-only
- `index.ts` still owns runtime wiring
- there is still exactly one root-level master `.svelte`

## 6. Validate Narrowly, Then Broadly

- run the narrowest useful test or check for the touched slice
- if the refactor affects compile-time behavior, run the narrow build or typecheck available
- then run `npm run build`

## 7. Final Review

- confirm the new behavior works
- confirm no unrelated tool contract was broken
- confirm any local image / video / text input still goes through the shared `src/lib/runtime/file-input/` runtime
- confirm any new docs or spec references were actually followed
