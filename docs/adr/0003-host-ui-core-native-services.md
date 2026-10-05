# ADR 0003：Host UI、Host Core 与 Native Services 分层

状态：已接受。日期：2026-09-07。

Deshelf 保持客户端内部的界面与应用逻辑分离，不以浏览器、服务器或原生进程的位置定义“前后端”。统一采用 **Host UI（宿主表现层）**、**Host Core（宿主应用核心）** 与 **Native Services（原生服务）**，替代“前前端／前后端／后后端”。这些名称借用常见分层术语，是本项目的明确约定，而非一套业界统一标准。

## 职责边界

- **Host UI**：Workspace、Standard Inspector、资源与导出界面、诊断展示，以及面板折叠、弹窗开关、输入草稿等界面局部状态。
- **Host Core**：Catalog 消费、Session 生命周期、Parameter Store 权威状态、应用规则、命令执行与资源/导出协调。UI 通过应用接口发起操作、观察结果，不自行维护第二份权威运行状态。
- **Native Services**：仅在 Desktop 提供原生编译执行、系统 API 与原生 IO。普通应用逻辑不因使用 Desktop 而整体迁入原生进程。
- **Platform Adapters**：连接应用核心与平台能力；Web 使用浏览器能力，Desktop 按需调用 Native Services。此处的平台适配边界不等于 Host 与 Tool Container 之间的 Environment API。

Deshelf Host 是包含 Host UI 与 Host Core 的整体，不是 Host Core 的同义词。以上是逻辑职责，不要求每层对应一个独立 package、进程或网络服务。

## 两端与 Tool Container

Web 保持纯前端部署：Host UI、Host Core 与 Tool 运行都在浏览器本地，消费构建期预编译的 Catalog/artifacts，不依赖运行时服务器。Desktop 保留同一逻辑分层，仅编译、系统能力和原生 IO 经过 Native Services。

Tool Container 仍是独立的 Tool 运行边界，不属于 Native Services。Canvas、simulation 与 GPU/rAF 热路径留在 Container，逐帧数据不经过 Host UI/Core 管理接口或原生服务链。

## Prototype 策略

下一阶段以 **Host UI → Mock Host Core** 开发可交互原型，不接入真实 Host Core、Tool Container 或 Native Services。

Mock Host Core 是基于内存状态和确定性场景的轻量应用接口替身，负责模拟数据、状态变化与操作反馈；不复刻 Session 引擎、Environment API 或 IPC 协议。界面局部状态仍由 UI 持有。接口允许随设计探索调整，原型通过不代表真实框架集成已通过；设计收敛后另行验证真实接入。

## 取舍

- 不使用 BFF：它通常表达面向特定前端的服务端，与纯客户端分层不符。
- 使用 Core 而非仅 Application Layer：这里统称应用编排、权威状态与领域规则，而非只指用例编排层。
- 不将 mock 状态散落到各页面，也不为未来接入提前构建完整假后端；保持明确边界，但避免把原型变成第二套运行框架。

本 ADR 确认术语与后续设计边界，不宣称现有代码已完成相应模块重构。`docs/` 仅用于仓库内 checkpoint 与 ADR，不恢复前端 Docs 页面或开发手册体系。
