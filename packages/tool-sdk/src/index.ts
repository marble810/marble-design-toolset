/**
 * tool-sdk: defineVisualTool + descriptor-only Inspector SDK + typed handles.
 * No Host DOM, Svelte, GPU or transport wiring here.
 */
export { defineVisualTool } from './define-visual-tool.ts';
export type {
	AssetSlotDefinition,
	CommandDefinition,
	CommandExecutionContext,
	ComputeFn,
	ParameterDefinition,
	ParameterValue,
	VisualOutputDefinition,
	VisualToolDefinition
} from './define-visual-tool.ts';

export { defineInspectorCallback } from './define-inspector-callback.ts';
export type { InspectorCallback } from './define-inspector-callback.ts';

export { createInspectorContext, collectInspectorElements } from './context.ts';
export type { CreateInspectorContextInput, InspectorContext } from './context.ts';

export { EnvironmentClient } from './client.ts';
export type { EnvironmentClientOptions, EnvironmentMessageHandler } from './client.ts';

export {
	CONTAINER_INBOUND_MESSAGE_NAMES,
	startToolContainer
} from './container/runtime.ts';
export type {
	ContainerAssetMirror,
	ContainerParameterMirror,
	ContainerSurfaceContext,
	ToolContainerRuntimeHandle,
	ToolContainerRuntimeOptions
} from './container/runtime.ts';

export type {
	AssetHandle,
	ButtonOptions,
	CommandHandle,
	InspectorRoot,
	ParameterHandle,
	PrivateCallbackHandle,
	SelectOptions,
	SliderOptions,
	TextOptions,
	ToggleOptions
} from './inspector.ts';
