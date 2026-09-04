/**
 * tool-contract: pure TypeScript types + runtime schema validators for the Deshelf
 * Catalog-driven Tool runtime. No Svelte, DOM, Electron or Vite imports.
 */
export { CONTRACT_VERSION, SUPPORTED_LIBRARIES, ID_PATTERN, SLUG_PATTERN, SEMVER_PATTERN, FORBIDDEN_MANIFEST_FIELDS } from './manifest.ts';
export type { ContractVersion, FrameworkLibraryId, ToolManifest } from './manifest.ts';
export { validateManifest } from './manifest.ts';

export { catalogEntryId } from './catalog.ts';
export type { CatalogArtifacts, CatalogEntry, CatalogSourceRef, CatalogSurfaces } from './catalog.ts';

export type { ParameterConstraint, ParameterDescriptor, ParameterMode, ParameterType } from './parameter.ts';
export { validateParameterMap } from './parameter.ts';

export type { AssetKind, AssetSlotDescriptor } from './asset.ts';
export { validateAssetMap } from './asset.ts';

export type { ToolCommandDescriptor } from './command.ts';
export { validateCommandMap } from './command.ts';

export type { PrivateCallbackDescriptor } from './private-callback.ts';
export { validatePrivateCallbackMap } from './private-callback.ts';

export type { OutputKind, VisualOutputDescriptor } from './output.ts';
export { validateOutputMap } from './output.ts';

export type { InspectorBinding, InspectorElement, InspectorTargets, InspectorTreeDescriptor, InspectorVisibilityRule } from './inspector.ts';
export { validateInspectorTree } from './inspector.ts';

export type { Diagnostic, Result } from './diagnostics.ts';
export { error, fail, ok } from './diagnostics.ts';

import type { Diagnostic } from './diagnostics.ts';
import type { ParameterValue } from './environment.ts';

// Re-export the Environment API contract (types + runtime schemas + transport seam).
export {
	ENVIRONMENT_PROTOCOL_VERSION,
	ENVIRONMENT_MESSAGE_NAMES,
	createEnvironmentEnvelope,
	validateEnvironmentEnvelope,
	validateEnvironmentPayload
} from './environment.ts';
export type {
	AssetChangedPayload,
	AssetContent,
	AssetRequestPayload,
	AssetResponsePayload,
	AssetSnapshot,
	BootPayload,
	BootSurface,
	CommandCancelPayload,
	CommandExecutePayload,
	CommandResultPayload,
	DiagnosticEmitPayload,
	EnvironmentEndpointRole,
	EnvironmentEnvelope,
	EnvironmentInventory,
	EnvironmentMessageKind,
	EnvironmentMessageName,
	EnvironmentMessagePayload,
	EnvironmentProtocolVersion,
	ExportContent,
	ExportExecutePayload,
	ExportResultPayload,
	ParameterChangedPayload,
	ParameterComputeRequestPayload,
	ParameterComputeResponsePayload,
	ParameterSetRequestPayload,
	ParameterSetResponsePayload,
	ParameterSnapshot,
	ParameterSnapshotRequestPayload,
	ParameterSnapshotResponsePayload,
	SurfaceDisposePayload,
	SurfaceKind,
	SurfaceReadyPayload,
	SurfaceResizePayload
} from './environment.ts';
export { createInMemoryTransportPair, recordTransport } from './environment-transport.ts';
export type { EnvironmentTransport, InMemoryTransportPair, Unsubscribe } from './environment-transport.ts';
export type { ParameterValue } from './environment.ts';

export { assertSerializable, collectSerializationDiagnostics } from './serializable.ts';

export { validateCatalogEntry, validateCatalogSourceRef } from './validate.ts';
