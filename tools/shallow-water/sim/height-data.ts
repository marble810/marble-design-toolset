/**
 * Init map height decoding: turns the selected Asset/preset source into the Float32
 * height field that seeds the simulation. The image path reads pixels from the
 * container-local blob URL delivered by the Host asset adapter — real file paths never
 * reach the Tool.
 */
import { renderPresetInitMap, type PresetInitMapDescriptor } from '../preset-init-map.ts';
import type { SimParameters } from '../parameters.ts';

export type InitMapSource =
	| { kind: 'image'; url: string }
	| { kind: 'preset'; preset: PresetInitMapDescriptor };

export function createInitMapSourceKey(source: InitMapSource): string {
	return source.kind === 'image' ? `image|${source.url}` : `preset|${createPresetKey(source.preset)}`;
}

function createPresetKey(preset: PresetInitMapDescriptor): string {
	if (preset.kind === 'circle' || preset.kind === 'square') {
		return [
			preset.kind,
			preset.mode,
			preset.centerX.toFixed(4),
			preset.centerY.toFixed(4),
			preset.size.toFixed(4),
			preset.outlineWidth.toFixed(4),
			preset.feather.toFixed(4)
		].join('|');
	}
	return [preset.kind, preset.position.toFixed(4), preset.thickness.toFixed(4), preset.feather.toFixed(4)].join('|');
}

export async function loadInitMapHeightData(source: InitMapSource, sim: SimParameters): Promise<Float32Array> {
	const grayscaleData =
		source.kind === 'image'
			? await loadImageGrayscaleData(source.url, sim.resolution)
			: renderPresetInitMap(source.preset, sim.resolution, sim.resolution);
	const heightData = new Float32Array(grayscaleData.length);

	for (let index = 0; index < heightData.length; index += 1) {
		const sourceValue = sim.invert ? 1 - grayscaleData[index] : grayscaleData[index];
		heightData[index] = sourceValue * sim.amplitude;
	}

	return heightData;
}

async function loadImageGrayscaleData(url: string, resolution: number): Promise<Float32Array> {
	const image = await loadImage(url);
	const canvas = document.createElement('canvas');
	canvas.width = resolution;
	canvas.height = resolution;
	const context = canvas.getContext('2d', { willReadFrequently: true });
	if (!context) {
		throw new Error('Failed to read init map pixels.');
	}

	context.clearRect(0, 0, canvas.width, canvas.height);
	context.drawImage(image, 0, 0, canvas.width, canvas.height);
	const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
	const grayscaleData = new Float32Array(resolution * resolution);

	for (let index = 0; index < grayscaleData.length; index += 1) {
		const pixelIndex = index * 4;
		grayscaleData[index] =
			(0.2126 * pixels[pixelIndex] +
				0.7152 * pixels[pixelIndex + 1] +
				0.0722 * pixels[pixelIndex + 2]) /
			255;
	}

	return grayscaleData;
}

function loadImage(url: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error('Failed to load init map image.'));
		image.src = url;
	});
}
