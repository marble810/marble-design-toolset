## MODIFIED Requirements

### Requirement: 工作区提供持久化壳层 Header
应用 SHALL 渲染一个共享工作区 Header，其中包含应用标题，以及用于打开工具、访问帮助、打开文档和打开设置的顶层操作入口。Docs 入口 SHALL 以新标签页打开独立文档浏览页面，而不替换当前工作区页面。

#### Scenario: 工作区壳层被渲染
- **WHEN** 应用在受支持视口中加载
- **THEN** Header 显示工作区标题以及 Open、Help、Docs、Settings 控件

#### Scenario: 从壳层进入设置
- **WHEN** 用户激活 Settings 控件
- **THEN** 工作区在不离开当前工作区上下文的情况下打开设置界面

#### Scenario: 从壳层打开文档页
- **WHEN** 用户激活 Docs 控件
- **THEN** 浏览器以新标签页打开独立文档浏览页面，并保留当前工作区页面状态不变