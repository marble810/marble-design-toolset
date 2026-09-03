/**
 * Shared Environment API conformance over the in-memory transport pair. The Web iframe
 * adapter (src/lib/forge) runs the same suite over its own transport pair; Desktop will
 * reuse it with MessagePorts. Only the transport differs — the semantics asserted here
 * are the shared contract.
 */
import { describe, test } from 'bun:test';
import { createInMemoryTransportPair } from 'tool-contract';
import { runEnvironmentConformanceTests, type EnvironmentConformanceHarness } from '../src/conformance/index.ts';
import { startToolContainer } from 'tool-sdk';

async function flush(): Promise<void> {
	// In-memory delivery is synchronous; drain microtasks and pending timers.
	for (let i = 0; i < 3; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

describe('Environment API conformance (in-memory transport)', () => {
	test('passes the shared conformance suite', async () => {
		const harness: EnvironmentConformanceHarness = {
			createPair: () => createInMemoryTransportPair(),
			startContainer: ({ pair, endpoint, definition }) =>
				startToolContainer({
					transport: pair.container,
					endpoint,
					definition,
					loadDefinition: () => Promise.resolve(definition),
					mountSurface: () => () => {}
				}),
			flush
		};
		await runEnvironmentConformanceTests(harness);
	});
});
