/**
 * Realm lifecycle tests: WebContents + MessagePort handoff, secure defaults,
 * Restart/Close teardown without WebContents or port leaks, external destroy tracking.
 */
import { describe, expect, test } from 'bun:test';
import { ToolRealmManager } from '../src/main/realms.ts';
import { BRIDGE } from '../src/shared/bridge-protocol.ts';
import { FakeMessageChannelFactory, FakeWebContents } from './fakes/realms.ts';

const BOUNDS = { x: 10, y: 20, width: 640, height: 360 };

function createManager() {
	const created: FakeWebContents[] = [];
	const channels = new FakeMessageChannelFactory();
	const diagnostics: Array<{ severity: string; code: string }> = [];
	const manager = new ToolRealmManager(
		{
			create(options) {
				const wc = new FakeWebContents(options.webPreferences);
				created.push(wc);
				return wc;
			}
		},
		channels,
		(severity, code) => diagnostics.push({ severity, code })
	);
	return { manager, created, channels, diagnostics };
}

describe('ToolRealmManager', () => {
	test('creates sandboxed WebContents and transfers exactly one port', async () => {
		const { manager, created, channels } = createManager();
		const realm = await manager.openRealm({ sessionId: 's1', endpoint: 'main', containerUrl: 'deshelf-cache://builds/x/container.html', bounds: BOUNDS });

		expect(created).toHaveLength(1);
		expect(created[0].webPreferences).toEqual({ sandbox: true, contextIsolation: true, nodeIntegration: false });
		expect(created[0].postedMessages).toHaveLength(1);
		expect(created[0].events).toEqual(['load', 'postMessage']);
		expect(created[0].bounds).toEqual(BOUNDS);
		const handoff = created[0].postedMessages[0];
		expect(handoff.channel).toBe(BRIDGE.portHandoff);
		expect(handoff.transfer).toEqual([channels.channels[0].port1]);
		expect(channels.channels[0].port1.started).toBe(true);
		expect(realm.hostPort).toBe(channels.channels[0].port2);
		expect(manager.hasRealm('s1', 'main')).toBe(true);
	});

	test('refuses duplicate realms for the same session+endpoint', async () => {
		const { manager } = createManager();
		await manager.openRealm({ sessionId: 's1', endpoint: 'main', containerUrl: 'x', bounds: BOUNDS });
		expect(manager.openRealm({ sessionId: 's1', endpoint: 'main', containerUrl: 'x', bounds: BOUNDS })).rejects.toThrow('realm already open');
	});

	test('closeRealm isolates Slate failure and bounds updates reach the visible view', async () => {
		const { manager, created } = createManager();
		await manager.openRealm({ sessionId: 's1', endpoint: 'main', containerUrl: 'x', bounds: BOUNDS });
		await manager.openRealm({ sessionId: 's1', endpoint: 'slate', containerUrl: 'x', bounds: BOUNDS });
		const resized = { x: 30, y: 40, width: 800, height: 120 };
		manager.setBounds('s1', 'main', resized);
		expect(created[0].bounds).toEqual(resized);
		manager.closeRealm('s1', 'slate');
		expect(created[1].destroyed).toBe(true);
		expect(created[0].destroyed).toBe(false);
		expect(manager.hasRealm('s1', 'main')).toBe(true);
		expect(manager.hasRealm('s1', 'slate')).toBe(false);
	});

	test('closeSession destroys every realm WebContents and closes ports (no leaks)', async () => {
		const { manager, created, channels } = createManager();
		await manager.openRealm({ sessionId: 's1', endpoint: 'main', containerUrl: 'x', bounds: BOUNDS });
		await manager.openRealm({ sessionId: 's1', endpoint: 'slate', containerUrl: 'x', bounds: BOUNDS });
		await manager.openRealm({ sessionId: 's2', endpoint: 'main', containerUrl: 'x', bounds: BOUNDS });

		manager.closeSession('s1');
		expect(created[0].destroyed).toBe(true);
		expect(created[1].destroyed).toBe(true);
		expect(created[2].destroyed).toBe(false);
		expect(manager.openRealmCount).toBe(1);
		// port1 of each channel left Main at transfer; the never-transferred host port2
		// of s1 realms must be closed, s2 stays open.
		expect(channels.channels[0].port2.closed).toBe(true);
		expect(channels.channels[1].port2.closed).toBe(true);
		expect(channels.channels[2].port2.closed).toBe(false);

		manager.closeSession('s1'); // idempotent
		expect(manager.openRealmCount).toBe(1);
		manager.closeAll();
		expect(created[2].destroyed).toBe(true);
		expect(manager.openRealmCount).toBe(0);
	});

	test('external destroy is reported and forgotten (tracking stays honest)', async () => {
		const { manager, created, diagnostics } = createManager();
		await manager.openRealm({ sessionId: 's1', endpoint: 'main', containerUrl: 'x', bounds: BOUNDS });
		created[0].simulateExternalDestroy();
		expect(diagnostics.some((d) => d.code === 'realm/webcontents-destroyed')).toBe(true);
		expect(manager.hasRealm('s1', 'main')).toBe(false);
	});

	test('load failure produces a diagnostic and releases the failed realm', async () => {
		const { manager, created } = createManager();
		created.push(new FakeWebContents({}));
		// Replace factory to inject a failing WebContents.
		const failing = new FakeWebContents({ sandbox: true, contextIsolation: true, nodeIntegration: false });
		failing.loadURL = async () => {
			throw new Error('ERR_NAME_NOT_RESOLVED');
		};
		const diagnostics: Array<{ severity: string; code: string }> = [];
		const failingManager = new ToolRealmManager(
			{ create: () => failing },
			new FakeMessageChannelFactory(),
			(severity, code) => diagnostics.push({ severity, code })
		);
		await expect(failingManager.openRealm({ sessionId: 's1', endpoint: 'main', containerUrl: 'deshelf-cache://bad', bounds: BOUNDS })).rejects.toThrow('ERR_NAME_NOT_RESOLVED');
		expect(diagnostics.some((d) => d.code === 'realm/load-failed')).toBe(true);
		expect(failingManager.hasRealm('s1', 'main')).toBe(false);
		expect(failing.destroyed).toBe(true);
		void manager;
	});
});
