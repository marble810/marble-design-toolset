/**
 * Catalog identity: logical Project ID is separated from the Catalog Source.
 * The Host-local catalogEntryId is deterministically derived from source + projectId,
 * so the same Project ID at multiple Locations never collides.
 */
import type { AssetSlotDescriptor } from './asset.ts';
import type { ToolCommandDescriptor } from './command.ts';
import type { InspectorTreeDescriptor } from './inspector.ts';
import type { ParameterDescriptor } from './parameter.ts';
import type { PrivateCallbackDescriptor } from './private-callback.ts';
import type { VisualOutputDescriptor } from './output.ts';

export type CatalogSourceRef =
	| { kind: 'web'; sourceId: string }
	| { kind: 'desktop'; projectLocationId: string };

export interface CatalogArtifacts {
	main: string;
	slate?: string;
}

export interface CatalogSurfaces {
	canvas: true;
	slate: boolean;
}

export interface CatalogEntry {
	catalogEntryId: string;
	source: CatalogSourceRef;
	projectId: string;
	slug: string;
	name: string;
	description?: string;
	tags?: string[];
	version: string;
	forgeProfile: string;
	libraries: string[];
	artifacts: CatalogArtifacts;
	parameters: Record<string, ParameterDescriptor>;
	assets: Record<string, AssetSlotDescriptor>;
	commands: Record<string, ToolCommandDescriptor>;
	privateCallbacks: Record<string, PrivateCallbackDescriptor>;
	outputs: Record<string, VisualOutputDescriptor>;
	inspectorTree: InspectorTreeDescriptor;
	surfaces: CatalogSurfaces;
}

export function catalogEntryId(source: CatalogSourceRef, projectId: string): string {
	const sourceId = source.kind === 'web' ? source.sourceId : source.projectLocationId;
	return `${source.kind}:${sourceId.length}:${sourceId}:${projectId.length}:${projectId}`;
}
