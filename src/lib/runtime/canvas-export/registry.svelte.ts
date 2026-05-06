import type {
	CanvasExporterDescriptor,
	CanvasExporterRegistrationOptions,
	RegisteredExporter,
	ResolvedCapabilities
} from '$lib/types/canvas-export';

/**
 * Resolve the effective capabilities of an exporter descriptor.
 *
 * - kind=dom is forced to mp4=false and pngBitDepth=8 regardless of declaration.
 * - pngBitDepth=16 is only honored when the exporter actually provides the
 *   matching 16-bit pixel source (getPixels16 / renderFrame16).
 */
export function resolveCapabilities(descriptor: CanvasExporterDescriptor): ResolvedCapabilities {
	if (descriptor.kind === 'dom') {
		const requestedPng = descriptor.capabilities?.png ?? true;
		return {
			png: requestedPng,
			mp4: false,
			pngBitDepth: 8
		};
	}

	const caps = descriptor.capabilities ?? {};
	const png = caps.png ?? true;
	const mp4 = caps.mp4 ?? true;
	const requested = caps.pngBitDepth ?? 8;

	let pngBitDepth: 8 | 16 = 8;
	if (requested === 16) {
		if (descriptor.kind === 'canvas' && typeof descriptor.getPixels16 === 'function') {
			pngBitDepth = 16;
		} else if (descriptor.kind === 'render' && typeof descriptor.renderFrame16 === 'function') {
			pngBitDepth = 16;
		}
	}

	return { png, mp4, pngBitDepth };
}

export interface CanvasExportRegistry {
	readonly exporters: ReadonlyArray<RegisteredExporter>;
	register: (
		descriptor: CanvasExporterDescriptor,
		options?: CanvasExporterRegistrationOptions
	) => () => void;
}

export function createRegisteredExporterEntry(
	descriptor: CanvasExporterDescriptor,
	options: CanvasExporterRegistrationOptions,
	sequence: number,
	existingIds: readonly string[] = []
): RegisteredExporter {
	const fallbackId = `exporter-${sequence}`;
	const baseId = normalizeExporterId(options.id) ?? fallbackId;
	const id = createUniqueExporterId(baseId, existingIds);
	const label = normalizeExporterLabel(options.label) ?? createDefaultExporterLabel(descriptor, sequence);

	return {
		id,
		label,
		descriptor,
		resolved: resolveCapabilities(descriptor)
	};
}

function normalizeExporterId(value: string | undefined): string | null {
	const normalized = value
		?.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return normalized || null;
}

function normalizeExporterLabel(value: string | undefined): string | null {
	const normalized = value?.trim();
	return normalized || null;
}

function createUniqueExporterId(baseId: string, existingIds: readonly string[]): string {
	if (!existingIds.includes(baseId)) return baseId;
	let suffix = 2;
	let nextId = `${baseId}-${suffix}`;
	while (existingIds.includes(nextId)) {
		suffix += 1;
		nextId = `${baseId}-${suffix}`;
	}
	return nextId;
}

function createDefaultExporterLabel(descriptor: CanvasExporterDescriptor, sequence: number): string {
	const kindLabel = descriptor.kind === 'dom' ? 'DOM' : descriptor.kind === 'render' ? 'Render' : 'Canvas';
	return `${kindLabel} ${sequence}`;
}

export function removeRegisteredExporter(
	exporters: readonly RegisteredExporter[],
	exporterId: string
): RegisteredExporter[] {
	return exporters.filter((existing) => existing.id !== exporterId);
}

export function createCanvasExportRegistry(): CanvasExportRegistry {
	let exporters = $state<RegisteredExporter[]>([]);
	let nextId = 0;

	function register(
		descriptor: CanvasExporterDescriptor,
		options: CanvasExporterRegistrationOptions = {}
	): () => void {
		nextId += 1;
		const entry = createRegisteredExporterEntry(
			descriptor,
			options,
			nextId,
			exporters.map((exporter) => exporter.id)
		);
		exporters = [...exporters, entry];

		return () => {
			exporters = removeRegisteredExporter(exporters, entry.id);
		};
	}

	return {
		get exporters() {
			return exporters;
		},
		register
	};
}
