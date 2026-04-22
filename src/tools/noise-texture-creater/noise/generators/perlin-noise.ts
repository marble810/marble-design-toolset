import {
	clamp01,
	hashCoordinates,
	lerp,
	type PerlinNoiseParameters,
	type SharedNoiseParameters
} from '../shared.ts';

const GRADIENTS: Array<[number, number]> = [
	[1, 0],
	[-1, 0],
	[0, 1],
	[0, -1],
	[0.70710678, 0.70710678],
	[-0.70710678, 0.70710678],
	[0.70710678, -0.70710678],
	[-0.70710678, -0.70710678]
];

function fade(value: number): number {
	return value * value * value * (value * (value * 6 - 15) + 10);
}

function gradient(ix: number, iy: number, seed: number): [number, number] {
	const hash = hashCoordinates(ix, iy, seed);
	return GRADIENTS[hash % GRADIENTS.length];
}

function dotGridGradient(ix: number, iy: number, x: number, y: number, seed: number): number {
	const [gx, gy] = gradient(ix, iy, seed);
	return gx * (x - ix) + gy * (y - iy);
}

function samplePerlinLayer(x: number, y: number, seed: number): number {
	const x0 = Math.floor(x);
	const x1 = x0 + 1;
	const y0 = Math.floor(y);
	const y1 = y0 + 1;

	const sx = fade(x - x0);
	const sy = fade(y - y0);

	const n00 = dotGridGradient(x0, y0, x, y, seed);
	const n10 = dotGridGradient(x1, y0, x, y, seed);
	const n01 = dotGridGradient(x0, y1, x, y, seed);
	const n11 = dotGridGradient(x1, y1, x, y, seed);

	const ix0 = lerp(n00, n10, sx);
	const ix1 = lerp(n01, n11, sx);
	return lerp(ix0, ix1, sy);
}

export function samplePerlinNoise(
	x: number,
	y: number,
	shared: SharedNoiseParameters,
	params: PerlinNoiseParameters
): number {
	const baseX = (x + shared.offsetX) * shared.scale;
	const baseY = (y + shared.offsetY) * shared.scale;

	let frequency = 1;
	let amplitude = 1;
	let total = 0;
	let amplitudeSum = 0;

	for (let octave = 0; octave < params.octaves; octave += 1) {
		const seed = shared.seed + octave * 1013;
		total += samplePerlinLayer(baseX * frequency, baseY * frequency, seed) * amplitude;
		amplitudeSum += amplitude;
		amplitude *= params.persistence;
		frequency *= params.lacunarity;
	}

	const normalized = amplitudeSum > 0 ? total / amplitudeSum : 0;
	const mapped = (normalized + 1) * 0.5;
	return Math.pow(clamp01(mapped), params.exponent);
}