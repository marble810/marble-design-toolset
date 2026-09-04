import { expect, test } from 'bun:test';
import { PARAMETER_DEFINITIONS } from './parameters.ts';

test('flow magnitude is Host-scheduled computed state derived from both flow axes', () => {
	const definition = PARAMETER_DEFINITIONS.flowMagnitude;
	expect(definition?.mode).toBe('computed');
	expect(definition?.dependsOn).toEqual(['flowX', 'flowY']);
	expect(definition?.compute?.({ flowX: 0.3, flowY: 0.4 })).toBeCloseTo(0.5);
});
