/**
 * tool-host: Deshelf Host Session core — Catalog-driven Tool Session lifecycle, Host-owned
 * Parameter Store, retained Standard Inspector, Tool Command lifecycle and staged Reload.
 * Framework-free: Web/Desktop apps wire EnvironmentTransport adapters and DOM rendering.
 */
export { DEFAULT_RUNTIME_CONFIG, resolveRuntimeConfig } from './runtime-config.ts';
export type { DeshelfRuntimeConfig } from './runtime-config.ts';

export { defaultTimer } from './timer.ts';
export type { Timer } from './timer.ts';

export { DiagnosticLog } from './diagnostics.ts';

export {
	ParameterStore,
	validateParameterValue
} from './parameter-store.ts';
export type {
	ComputeExecutor,
	ComputeOutcome,
	ComputeRequest,
	ParameterSetResult,
	ParameterStoreEvent
} from './parameter-store.ts';

export { ToolCommandRunner } from './command-runner.ts';
export type {
	CommandActionResult,
	CommandRunnerOptions,
	CommandStatusEvent,
	CommandStatusKind,
	CommandStatusListener
} from './command-runner.ts';

export { InspectorHost } from './inspector/inspector-host.ts';
export type { ActionStatusSource, InspectorHostOptions, InspectorNodeState, InspectorViewModel } from './inspector/inspector-host.ts';
export { buildDefaultInspectorTree } from './inspector/default-tree.ts';

export { ToolSession, migrateParameterValues, ReloadHandle } from './session.ts';
export type {
	BootOptions,
	ChannelRole,
	ReloadResult,
	ToolSessionHealth,
	ToolSessionOptions,
	ToolSessionState
} from './session.ts';

// Environment API types and validators are part of tool-contract; re-export for Host consumers.
export type { EnvironmentEnvelope, EnvironmentTransport } from 'tool-contract';
export { createEnvironmentEnvelope, validateEnvironmentEnvelope } from 'tool-contract';