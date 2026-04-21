## 1. 共享 tech-stack 类型契约

- [ ] 1.1 新增共享的 tech-stack 类型映射模块，并让 `TechStackKey` 从该映射派生，消除 key 与模块类型分散维护的问题。
- [ ] 1.2 重写 `loadTechStack` 的公开签名与内部 loader/cache 类型边界，使单 key 加载结果按 key 推导为对应模块类型。
- [ ] 1.3 重写 `loadTechStacks` 的泛型签名，使字面量 key 集合调用保留逐 key 类型推导，同时为宽化数组保留安全回退类型。

## 2. 工具侧开发体验迁移

- [ ] 2.1 更新代表性的 Three/Pixi 消费点，移除共享技术栈相关的 `any` 用法，改为 helper type 或 `import type` 模式。
- [ ] 2.2 更新 Pixi 工具编写指南及相关示例，明确共享 loader 与类型声明的推荐写法，避免后续工具继续复制 `unknown`/`any` 模式。

## 3. 验证与回归检查

- [ ] 3.1 为共享 tech-stack runtime 增加或补充聚焦验证，覆盖单 key 推导、批量 key 推导与缓存复用的关键路径。
- [ ] 3.2 运行 `npm run build` 与 `npm run test`，确认类型契约增强未破坏现有工作区加载和工具示例行为。