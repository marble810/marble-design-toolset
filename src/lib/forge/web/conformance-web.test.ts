/**
 * Deshelf Web adapter conformance: the SAME shared Environment API conformance suite
 * the in-memory tool-host tests run, executed over the real Web iframe transport pair
 * (host transport + container transport + container runtime) on fake same-origin
 * windows with browser-like async delivery. Only the transport differs from the
 * Desktop path — that is the point.
 */
import { describe, test } from 'bun:test';
import {
	runEnvironmentConformanceTests,
	type ConformanceTransportPair,
	type EnvironmentConformanceHarness
} from 'tool-host/conformance';
import { startToolContainer, type ToolContainerRuntimeHandle, type VisualToolDefinition } from 'tool-sdk';
import type { EnvironmentEndpointRole } from 'tool-contract';
import { createFakeWindowPair, FakeWindow } from '../iframe/fake-window.js';
import { createIframeHostTransport, type IframeLike } from '../iframe/host-transport.js';
import { createIframeContainerTransport } from '../iframe/container-transport.js';

const ORIGIN = 'https://deshelf.test';

function iframeAround(contentWindow: FakeWindow): IframeLike & { __fireLoad(): void } {
	const loadListeners = new Set<() => void>();
	return {
		contentWindow: contentWindow as unknown as IframeLike['contentWindow'],
		addEventListener(type: 'load', listener: () => void) {
			if (type === 'load') loadListeners.add(listener);
		},
		removeEventListener(type: 'load', listener: () => void) {
			if (type === 'load') loadListeners.delete(listener);
		},
		__fireLoad() {
			// The generated container document fires `load` once its bootstrap ran.
			for (const listener of [...loadListeners]) listener();
		}
	};
}

interface PairWindows {
	parent: FakeWindow;
	container: FakeWindow;
}

async function drain(): Promise<void> {
	// Auto-flushed windows deliver on microtasks; a few macrotask ticks settle the whole
	// chain (including the session's async continuations and timers).
	for (let i = 0; i < 4; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

describe('Environment API conformance (Web same-origin iframe transport)', () => {
	test('passes the shared conformance suite', async () => {
		// The suite creates each pair immediately before starting its container, so the
		// newest recorded windows always correspond to the container being started.
		let newest: PairWindows | undefined;
		const harness: EnvironmentConformanceHarness = {
			createPair(): ConformanceTransportPair {
				const { parent, container } = createFakeWindowPair(ORIGIN);
				parent.autoFlush = true;
				container.autoFlush = true;
				const iframe = iframeAround(container);
				const host = createIframeHostTransport({ iframe, listen: parent, origin: ORIGIN });
				// The generated container page fires `load` once its bootstrap is running.
				iframe.__fireLoad();
				newest = { parent, container };
				return { host, container: createIframeContainerTransport({ parent, listen: container, origin: ORIGIN }) };
			},
			startContainer({
				endpoint,
				definition
			}: {
				pair: ConformanceTransportPair;
				endpoint: EnvironmentEndpointRole;
				definition: VisualToolDefinition;
			}): ToolContainerRuntimeHandle {
				const windows = newest as PairWindows;
				return startToolContainer({
					transport: createIframeContainerTransport({ parent: windows.parent, listen: windows.container, origin: ORIGIN }),
					endpoint,
					definition,
					loadDefinition: () => Promise.resolve(definition),
					mountSurface: () => () => {}
				});
			},
			flush: drain
		};
		await runEnvironmentConformanceTests(harness);
	});
});
