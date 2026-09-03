/**
 * Tool Command lifecycle: single-flight, Runtime Config timeout → cancel, cancel grace →
 * Unresponsive health, and result routing.
 */
import { describe, expect, test } from 'bun:test';
import { ToolCommandRunner } from '../src/index.ts';
import { ManualTimer } from './helpers.ts';

function makeRunner(opts?: { commandTimeoutMs?: number; cancelGraceMs?: number }) {
	const timer = new ManualTimer();
	const sent: Array<{ kind: 'execute' | 'cancel'; invocationId: string; commandId?: string }> = [];
	const statuses: Array<{ commandId: string; status: string }> = [];
	let unresponsive = 0;
	const runner = new ToolCommandRunner({
		runtimeConfig: { startupTimeoutMs: 1000, commandTimeoutMs: opts?.commandTimeoutMs ?? 1000, cancelGraceMs: opts?.cancelGraceMs ?? 200, computeTimeoutMs: 500 },
		timer,
		sendExecute: (invocationId, commandId) => sent.push({ kind: 'execute', invocationId, commandId }),
		sendCancel: (invocationId) => sent.push({ kind: 'cancel', invocationId }),
		onUnresponsive: () => {
			unresponsive += 1;
		}
	});
	runner.subscribeStatus((event) => statuses.push({ commandId: event.commandId, status: event.status }));
	return { runner, timer, sent, statuses, get unresponsive() { return unresponsive; } };
}

describe('ToolCommandRunner', () => {
	test('execute sends command.execute and reports running', () => {
		const state = makeRunner();
		const result = state.runner.execute('resimulate');
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(state.sent[0]).toEqual({ kind: 'execute', invocationId: result.invocationId, commandId: 'resimulate' });
		}
		expect(state.statuses[0]).toEqual({ commandId: 'resimulate', status: 'running' });
	});

	test('single-flight: a running command rejects a second execute', () => {
		const state = makeRunner();
		state.runner.execute('resimulate');
		const second = state.runner.execute('resimulate');
		expect(second.ok).toBe(false);
		if (!second.ok) expect(second.diagnostic.code).toBe('command/single-flight');
		expect(state.sent.filter((m) => m.kind === 'execute')).toHaveLength(1);
	});

	test('result before timeout completes and frees the command', () => {
		const state = makeRunner();
		const first = state.runner.execute('resimulate');
		const rejected = state.runner.execute('resimulate'); // single-flight rejection, no status
		expect(rejected.ok).toBe(false);
		if (first.ok) {
			state.runner.onResult(first.invocationId, true);
			const again = state.runner.execute('resimulate');
			expect(again.ok).toBe(true);
			expect(state.statuses.map((s) => s.status)).toEqual(['running', 'completed', 'running']);
		}
	});

	test('timeout sends cancel and completes if the callback finishes during the grace window', () => {
		const state = makeRunner();
		const result = state.runner.execute('resimulate');
		state.timer.advance(1000); // timeout
		expect(state.sent).toContainEqual({ kind: 'cancel', invocationId: result.ok ? result.invocationId : '' });
		if (result.ok) {
			state.runner.onResult(result.invocationId, false);
		}
		expect(state.unresponsive).toBe(0);
		expect(state.statuses).toContainEqual({ commandId: 'resimulate', status: 'failed' });
	});

	test('cancel grace expiry marks the session Unresponsive; later result is accepted harmlessly', () => {
		const state = makeRunner();
		const result = state.runner.execute('resimulate');
		state.timer.advance(1000); // timeout → cancel sent
		expect(state.unresponsive).toBe(0);
		state.timer.advance(200); // grace expiry → Unresponsive
		expect(state.unresponsive).toBe(1);
		expect(state.statuses).toContainEqual({ commandId: 'resimulate', status: 'canceled' });

		if (result.ok) {
			// late completion must not crash; health stays Unresponsive (Restart is the remedy)
			state.runner.onResult(result.invocationId, true);
			expect(state.statuses).toContainEqual({ commandId: 'resimulate', status: 'completed' });
			const again = state.runner.execute('resimulate');
			expect(again.ok).toBe(true);
		}
	});

	test('unknown invocation results are ignored', () => {
		const state = makeRunner();
		state.runner.onResult('ghost', true);
		expect(state.statuses).toHaveLength(0);
	});

	test('dispose rejects new executions and clears state', () => {
		const state = makeRunner();
		state.runner.execute('resimulate');
		state.runner.dispose();
		const result = state.runner.execute('resimulate');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.diagnostic.code).toBe('command/closed');
	});
});