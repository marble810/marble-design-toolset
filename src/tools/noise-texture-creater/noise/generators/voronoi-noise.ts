import {
	clamp01,
	randomUnitFloat,
	smoothstep,
	type SharedNoiseParameters,
	type VoronoiNoiseParameters
} from '../shared.ts';

interface CellHit {
	distance: number;
	cellX: number;
	cellY: number;
}

function createCellPoint(cellX: number, cellY: number, jitter: number, seed: number) {
	return {
		x: cellX + 0.5 + (randomUnitFloat(cellX, cellY, seed) - 0.5) * jitter,
		y: cellY + 0.5 + (randomUnitFloat(cellX, cellY, seed + 17) - 0.5) * jitter
	};
}

export function sampleVoronoiNoise(
	x: number,
	y: number,
	shared: SharedNoiseParameters,
	params: VoronoiNoiseParameters
): number {
	const normalizedScale = Math.max(shared.scale / 6, 0.2);
	const scaledX = (x + shared.offsetX) * normalizedScale * params.cellDensity;
	const scaledY = (y + shared.offsetY) * normalizedScale * params.cellDensity;

	const baseCellX = Math.floor(scaledX);
	const baseCellY = Math.floor(scaledY);

	let nearest: CellHit = { distance: Number.POSITIVE_INFINITY, cellX: baseCellX, cellY: baseCellY };
	let secondNearest = Number.POSITIVE_INFINITY;

	for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
		for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
			const cellX = baseCellX + offsetX;
			const cellY = baseCellY + offsetY;
			const point = createCellPoint(cellX, cellY, params.jitter, shared.seed);
			const dx = point.x - scaledX;
			const dy = point.y - scaledY;
			const distance = Math.sqrt(dx * dx + dy * dy);

			if (distance < nearest.distance) {
				secondNearest = nearest.distance;
				nearest = { distance, cellX, cellY };
			} else if (distance < secondNearest) {
				secondNearest = distance;
			}
		}
	}

	const edgeDistance = Math.max(0, secondNearest - nearest.distance);
	const localRadius = Math.max(nearest.distance + edgeDistance * 0.5, 0.000001);
	const adjustedRadius = Math.max(localRadius * params.pointRadius, 0.000001);
	const centerToEdge = clamp01(1 - nearest.distance / adjustedRadius);
	const edgeFade = smoothstep(
		params.edgeWidth,
		params.edgeWidth + Math.max(0.001, params.edgeSoftness),
		centerToEdge
	);
	const pointFalloff = Math.pow(centerToEdge, params.pointSharpness);
	const fillField = params.fillStrength + (1 - params.fillStrength) * pointFalloff;
	const cellSeed = randomUnitFloat(nearest.cellX, nearest.cellY, shared.seed + 991);
	const cellAmplitude = 1 - params.cellVariation + cellSeed * params.cellVariation;
	return clamp01(fillField * edgeFade * cellAmplitude);
}