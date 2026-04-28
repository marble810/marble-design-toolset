import type { ShallowWaterParameters } from './shared.js';

export async function loadImageHeightData(
	objectUrl: string,
	parameters: ShallowWaterParameters
): Promise<Float32Array> {
	const image = await loadImage(objectUrl);
	const canvas = document.createElement('canvas');
	canvas.width = parameters.resolution;
	canvas.height = parameters.resolution;
	const context = canvas.getContext('2d', { willReadFrequently: true });
	if (!context) {
		throw new Error('Failed to read init map pixels.');
	}

	context.clearRect(0, 0, canvas.width, canvas.height);
	context.drawImage(image, 0, 0, canvas.width, canvas.height);
	const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
	const heightData = new Float32Array(parameters.resolution * parameters.resolution);

	for (let index = 0; index < heightData.length; index += 1) {
		const pixelIndex = index * 4;
		const luminance =
			(0.2126 * pixels[pixelIndex] +
				0.7152 * pixels[pixelIndex + 1] +
				0.0722 * pixels[pixelIndex + 2]) /
			255;
		const source = parameters.invert ? 1 - luminance : luminance;
		heightData[index] = source * parameters.amplitude;
	}

	return heightData;
}

function loadImage(objectUrl: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error('Failed to load init map image.'));
		image.src = objectUrl;
	});
}