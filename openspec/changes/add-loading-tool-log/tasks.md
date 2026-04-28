## 1. Loading Log State

- [x] 1.1 Add a local loading log data structure to `ToolSession.svelte` for the current load attempt.
- [x] 1.2 Reset loading logs whenever `toolId` or `reloadToken` starts a new load attempt.
- [x] 1.3 Guard log updates with the existing load version/disposed checks so stale async work cannot update the UI.

## 2. Runtime Load Steps

- [x] 2.1 Append an English log entry before and after loading the runtime definition.
- [x] 2.2 Append an English log entry before and after loading declared tech stacks, including a no-declared-stack path.
- [x] 2.3 Append an English log entry before and after loading the tool entry component.
- [x] 2.4 Append an English log entry when the session is ready to mount the loaded tool.

## 3. Loading And Error UI

- [x] 3.1 Render the log list in the centered Loading Tool status view.
- [x] 3.2 Render the most recent log list in the Tool failed to load state without removing the existing error message or Retry control.
- [x] 3.3 Style the log list with stable dimensions, compact spacing, and existing CSS custom properties.

## 4. Verification

- [x] 4.1 Run `npm run build` and fix any regressions introduced by the loading log changes.
- [x] 4.2 Manually verify opening a tool shows loading logs and successful mount removes the loading UI.
- [x] 4.3 Manually verify a failed load keeps the latest log context and Retry starts a fresh log list.