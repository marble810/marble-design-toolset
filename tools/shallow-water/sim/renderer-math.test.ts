import { describe, expect, test } from 'bun:test';
import { readSimParameters, structuralSimKey } from '../parameters.ts';
import {
	resolveDistortPhase,
	resolveFrameStepCount,
	resolveResolutionScale,
	resolveStepDamping
} from './renderer.ts';

describe('shallow water renderer math', () => {
	test('flow parameters default to no advection', () => {
		const sim = readSimParameters({});
		expect(sim.flowX).toBe(0);
		expect(sim.flowY).toBe(0);
		expect(sim.distortStrength).toBe(0);
	});

	test('sim view normalizes the flat parameter snapshot', () => {
		const sim = readSimParameters({
			resolution: '1024',
			amplitude: 0.9,
			waveSpeed: 0.2,
			flowX: -0.5,
			flowY: 0.25,
			distortStrength: 0.3,
			distortScale: 6,
			distortSpeed: 0.02,
			damping: 0.99,
			edgeAbsorb: 0.5,
			restThreshold: 0.001,
			stepsPerFrame: 5.7,
			contrast: 2,
			invert: true
		});
		expect(sim.resolution).toBe(1024);
		expect(sim.stepsPerFrame).toBe(6);
		expect(sim.flowX).toBe(-0.5);
		expect(sim.invert).toBe(true);
	});

	test('unknown select options fall back to safe defaults', () => {
		const sim = readSimParameters({ resolution: '9999' });
		expect(sim.resolution).toBe(256);
	});

	test('distort phase is deterministic and resolution-normalized', () => {
		expect(resolveDistortPhase(8, 0.01, 0.5)).toBeCloseTo(0.16);
		expect(resolveDistortPhase(16, 0.01, 1)).toBeCloseTo(0.16);
		expect(resolveDistortPhase(32, 0.01, 2)).toBeCloseTo(0.16);
		expect(resolveDistortPhase(0, 0.01, 2)).toBe(0);
	});

	test('resolution scale and step counts scale with the visible grid', () => {
		expect(resolveResolutionScale(128)).toBeCloseTo(0.5);
		expect(resolveResolutionScale(256)).toBe(1);
		expect(resolveResolutionScale(512)).toBe(2);
		expect(resolveFrameStepCount(0, 2, 2)).toBe(0);
		expect(resolveFrameStepCount(3, 2, 1)).toBe(6);
		expect(resolveFrameStepCount(3, 2, 2)).toBe(12);
	});

	test('per-step damping keeps logical damping constant across resolutions', () => {
		expect(resolveStepDamping(0.99, 1)).toBeCloseTo(0.99, 10);
		expect(Math.pow(resolveStepDamping(0.99, 4), 4)).toBeCloseTo(0.99, 10);
	});

	test('structural keys change only when the initial height field changes', () => {
		const base = readSimParameters({ resolution: '256' });
		const sourceKey = 'preset|circle';
		const first = structuralSimKey(base, sourceKey, 0);
		expect(structuralSimKey(readSimParameters({ resolution: '256', contrast: 6 }), sourceKey, 0)).toBe(first);
		expect(structuralSimKey(readSimParameters({ resolution: '512' }), sourceKey, 0)).not.toBe(first);
		expect(structuralSimKey(base, sourceKey, 1)).not.toBe(first);
		expect(structuralSimKey(base, 'preset|square', 0)).not.toBe(first);
	});
});
