/**
 * Deshelf Desktop adapter conformance: the SAME shared Environment API conformance
 * suite the in-memory tool-host tests and the Web iframe adapter run, executed over the
 * real MessagePort transport pair (Host UI renderer port ↔ Tool Container renderer port,
 * bridged by a fake MessageChannelMain handoff) with browser-like async delivery.
 *
 * Only the transport differs from the Web path — that is the point: the shared contract
 * proves that Desktop tool sessions keep identical Environment API semantics.
 */
import { describe, test } from 'bun:test';
import {
	runEnvironmentConformanceTests,
	type ConformanceTransportPair,
	type EnvironmentConformanceHarness
} from 'tool-host/conformance';
import { startToolContainer, type ToolContainerRuntimeHandle, type VisualToolDefinition } from 'tool-sdk';
import type { EnvironmentEndpointRole } from 'tool-contract';
import { createPortTransport, type PortLike } from '../src/transport/port-transport.ts';
import {
	drainPorts,
	FakeMessageChannelMain,
	FakeRendererPort,
	transferToRenderer
} from './fakes/ports.ts';

interface DesktopPair extends ConformanceTransportPair {
	containerPort: FakeRendererPort;
}

describe('Environment API conformance (Desktop MessagePort transport)', () => {
	test('passes the shared conformance suite', async () => {
		// The suite creates each pair immediately before starting its container, so the
		// newest pair always corresponds to the container being started.
		let newest: DesktopPair | undefined;
		const harness: EnvironmentConformanceHarness = {
			createPair(): ConformanceTransportPair {
				// Main creates the channel and transfers both ends once (handoff); after that
				// the Main process never sees the traffic.
				const channel = new FakeMessageChannelMain();
				const containerPort = transferToRenderer(channel.port1);
				const hostPort = transferToRenderer(channel.port2);
				const pair: DesktopPair = {
					host: createPortTransport(hostPort as unknown as PortLike),
					container: createPortTransport(containerPort as unknown as PortLike),
					containerPort
				};
				newest = pair;
				return pair;
			},
			startContainer({
				endpoint,
				definition
			}: {
				pair: ConformanceTransportPair;
				endpoint: EnvironmentEndpointRole;
				definition: VisualToolDefinition;
			}): ToolContainerRuntimeHandle {
				const pair = newest as DesktopPair;
				return startToolContainer({
					transport: createPortTransport(pair.containerPort as unknown as PortLike),
					endpoint,
					loadDefinition: () => Promise.resolve(definition),
					mountSurface: () => () => {}
				});
			},
			flush: () => drainPorts()
		};
		await runEnvironmentConformanceTests(harness);
	});
});
