import type {
	CanvasExporterDescriptor,
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
	register: (descriptor: CanvasExporterDescriptor) => () => void;
}

export function createCanvasExportRegistry(): CanvasExportRegistry {
	let exporters = $state<RegisteredExporter[]>([]);
	let nextId = 0;

	function register(descriptor: CanvasExporterDescriptor): () => void {
		nextId += 1;
		const id = `exporter-${nextId}`;
		const resolved = resolveCapabilities(descriptor);
		const entry: RegisteredExporter = { id, descriptor, resolved };
		exporters = [...exporters, entry];

		return () => {
			exporters = exporters.filter((existing) => existing.id !== id);
		};
	}

	return {
		get exporters() {
			return exporters;
		},
		register
	};
}
