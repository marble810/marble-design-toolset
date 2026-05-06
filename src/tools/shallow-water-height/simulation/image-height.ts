import { renderPresetInitMap } from '$lib/runtime/preset-init-map.js';
import type { ShallowWaterInitMapSource, ShallowWaterParameters } from './shared.js';

export async function loadInitMapHeightData(
	source: ShallowWaterInitMapSource,
	parameters: ShallowWaterParameters
): Promise<Float32Array> {
	const grayscaleData =
		source.kind === 'image'
			? await loadImageGrayscaleData(source.objectUrl, parameters.resolution)
			: renderPresetInitMap(source.preset, parameters.resolution, parameters.resolution);
	const heightData = new Float32Array(grayscaleData.length);

	for (let index = 0; index < heightData.length; index += 1) {
		const sourceValue = parameters.invert ? 1 - grayscaleData[index] : grayscaleData[index];
		heightData[index] = sourceValue * parameters.amplitude;
	}

	return heightData;
}

async function loadImageGrayscaleData(
	objectUrl: string,
	resolution: number
): Promise<Float32Array> {
	const image = await loadImage(objectUrl);
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

function loadImage(objectUrl: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error('Failed to load init map image.'));
		image.src = objectUrl;
	});
}