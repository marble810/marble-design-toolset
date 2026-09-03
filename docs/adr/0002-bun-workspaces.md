---
status: accepted
---

# 使用 Bun 作为仓库 Workspace 的唯一包管理器

Deshelf 需要管理 `packages/tool-contract`、`tool-sdk`、`tool-host` 与 `tool-builder` 等 Workspace packages；仓库此前同时保留 npm 与 Bun lockfiles，导致本地安装、Workspace linking 与 CI 的依赖图可能分叉。项目决定使用 Bun workspaces、`bun.lock` 与 `bun run` 作为唯一仓库工作流，删除 `package-lock.json`，并让 CI 使用 frozen Bun lockfile。Tool Project 仍不得拥有自身 `node_modules` 或第三方 packages；该决定只约束 Deshelf framework repository。
