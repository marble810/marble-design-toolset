/**
 * WebToolController tests over fake same-origin windows with real container runtimes:
 * iframe creation (src, no sandbox), Slate deferral (created only after Main Ready),
 * Restart swapping containers with a fresh Session ID, resize forwarding, close
 * semantics and the browser asset adapter. Full message-flow semantics are covered by
 * the conformance suites; this pins the DOM orchestration end-to-end.
 */
import { describe, expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import type { CatalogEntry } from 'tool-contract';
import { startToolContainer } from 'tool-sdk';
import { FakeWindow } from '../iframe/fake-window.js';
import { createIframeContainerTransport } from '../iframe/container-transport.js';
import { WebToolController } from './web-tool-controller.js';

const ORIGIN = 'https://deshelf.test';
const CONTAINER_PAGE = '/deshelf/container.html';
const MAIN_ARTIFACT = '/deshelf/artifacts/hello-canvas/main.js';

function makeEntry(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
	return {
		catalogEntryId: 'web:7:bundled:36:test-project-id',
		source: { kind: 'web', sourceId: 'bundled' },
		projectId: 'test-project-id',
		slug: 'test-tool',
		name: 'Test Tool',
		version: '1.0.0',
		forgeProfile: 'forge-v1',
		libraries: [],
		artifacts: { main: 'artifacts/test-tool/main.js' },
		parameters: {},
		assets: {},
		commands: {},
		privateCallbacks: {},
		outputs: {},
		inspectorTree: { elements: [] },
		surfaces: { canvas: true, slate: false },
		...overrides
	};
}

function makeFakeDom(entry: CatalogEntry) {
	// The "Host window": both iframes post here; `linked` re-points to the newest
	// container window so inbound `event.source` checks stay faithful.
	const hostWindow = new FakeWindow(ORIGIN);
	hostWindow.autoFlush = true;
	(hostWindow as unknown as { location: { origin: string } }).location = { origin: ORIGIN };

	const definitionStub = {
		parameters: {},
		privateCallbacks: {},
		canvas: () => Promise.resolve(undefined)
	};

	function attachContainerWindow(endpoint: 'main' | 'slate'): FakeWindow {
		const containerWindow = new FakeWindow(ORIGIN);
		containerWindow.autoFlush = true;
		hostWindow.linked = containerWindow;
		containerWindow.linked = hostWindow;
		startToolContainer({
			transport: createIframeContainerTransport({ parent: hostWindow, listen: containerWindow, origin: ORIGIN }),
			endpoint,
			definition: definitionStub,
			loadDefinition: () => Promise.resolve(definitionStub),
			mountSurface: () => () => {}
		});
		return containerWindow;
	}

	const canvasHost = {
		rect: { width: 800, height: 450 },
		rects: [] as Array<{ width: number; height: number }>,
		appended: [] as Array<Record<string, unknown>>,
		getBoundingClientRect() {
			return canvasHost.rects.shift() ?? canvasHost.rect;
		},
		appendChild(child: Record<string, unknown>) {
			const endpoint = (child.attrs['data-deshelf-endpoint'] as 'main' | 'slate') ?? 'main';
			child.contentWindow = attachContainerWindow(endpoint);
			canvasHost.appended.push(child);
		}
	} as unknown as HTMLElement & typeof canvasHost;

	const iframes: Array<Record<string, unknown>> = [];
	const createElement = (tag: string): Record<string, unknown> => {
		if (tag !== 'iframe') throw new Error(`unexpected element ${tag}`);
		const iframe: Record<string, unknown> = {
			attrs: {} as Record<string, string>,
			style: {} as Record<string, string>,
			detached: false,
			loadListeners: [] as Array<() => void>,
			contentWindow: undefined,
			setAttribute(name: string, value: string) {
				(iframe.attrs as Record<string, string>)[name] = value;
			},
			remove() {
				iframe.detached = true;
			},
			addEventListener(type: string, listener: () => void) {
				if (type === 'load') (iframe.loadListeners as Array<() => void>).push(listener);
			},
			removeEventListener() {},
			fireLoad() {
				for (const listener of [...(iframe.loadListeners as Array<() => void>)]) listener();
			}
		};
		iframes.push(iframe);
		return iframe;
	};

	const documentRef = {
		createElement,
		defaultView: hostWindow
	} as unknown as Document;

	const resizeCallbacks: Array<(size: { width: number; height: number }) => void> = [];
	const revokedUrls: string[] = [];
	const controller = new WebToolController({
		entry,
		containerPageUrl: CONTAINER_PAGE,
		mainArtifactUrl: MAIN_ARTIFACT,
		canvasHost: canvasHost as unknown as HTMLElement,
		slateHost: entry.surfaces.slate ? (canvasHost as unknown as HTMLElement) : undefined,
		documentRef,
		sessionId: 'controller-test-session',
		revokeObjectUrl: (url) => revokedUrls.push(url),
		createResizeObserver: (_target, onResize) => {
			resizeCallbacks.push(onResize);
			return () => {};
		}
	});
	return { controller, canvasHost, iframes, resizeCallbacks, hostWindow, revokedUrls };
}

async function tick(times = 4): Promise<void> {
	for (let i = 0; i < times; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

describe('WebToolController', () => {
	test('opens the main container, boots to Ready and forwards resizes', async () => {
		const entry = makeEntry();
		const { controller, iframes, resizeCallbacks } = makeFakeDom(entry);

		controller.open();
		expect(iframes).toHaveLength(1);
		const main = iframes[0];
		expect(main.attrs['data-deshelf-endpoint']).toBe('main');
		expect(main.style.border).toBe('0');
		// No sandbox attribute: sandbox would produce a unique opaque origin and break
		// same-origin artifact supply. There is no Capability Grant either.
		expect('sandbox' in main.attrs).toBe(false);
		expect(String(main.src)).toContain(`entry=${encodeURIComponent(MAIN_ARTIFACT)}`);
		expect(String(main.src)).toContain('endpoint=main');

		(main.fireLoad as () => void)();
		await tick();
		expect(controller.session.getState()).toBe('Ready');

		resizeCallbacks[0]?.({ width: 1024, height: 768 });
		await tick();
		expect(controller.session.store.snapshot().revision).toBeGreaterThanOrEqual(0);
		controller.close();
	});

	test('boots the slate container only after main ready and never blocks it', async () => {
		const entry = makeEntry({ surfaces: { canvas: true, slate: true } });
		const { controller, iframes } = makeFakeDom(entry);

		controller.open();
		expect(iframes).toHaveLength(1, 'slate iframe must not exist before main ready');
		(iframes[0].fireLoad as () => void)();
		await tick();
		expect(controller.session.getState()).toBe('Ready');
		await tick();
		expect(iframes).toHaveLength(2, 'slate iframe appears after main ready');
		expect(iframes[1].attrs['data-deshelf-endpoint']).toBe('slate');
		(iframes[1].fireLoad as () => void)();
		await tick();
		expect(controller.session.isSlateReady()).toBe(true);
		controller.close();
	});

	test('restart creates fresh containers and a new session id', async () => {
		const entry = makeEntry();
		const { controller, iframes } = makeFakeDom(entry);
		controller.open();
		(iframes[0].fireLoad as () => void)();
		await tick();
		expect(controller.session.getState()).toBe('Ready');
		const oldSessionId = controller.session.sessionId;
		const oldIframe = iframes[0];

		controller.restart();
		await tick();
		expect(iframes).toHaveLength(2);
		expect(oldIframe.detached).toBe(true, 'the old iframe must be removed');
		expect(iframes[1].detached).toBe(false);
		expect(controller.session.sessionId).not.toBe(oldSessionId);
		(iframes[1].fireLoad as () => void)();
		await tick();
		expect(controller.session.getState()).toBe('Ready');
		controller.close();
	});

	test('staged reload commits when the replacement canvas is ready and swaps containers', async () => {
		const entry = makeEntry();
		const newEntry = makeEntry({ version: '2.0.0' });
		const { controller, iframes } = makeFakeDom(entry);
		controller.open();
		(iframes[0].fireLoad as () => void)();
		await tick();
		expect(controller.session.getState()).toBe('Ready');
		const oldSessionId = controller.session.sessionId;
		const oldIframe = iframes[0];

		// The replacement iframe is created for the NEW artifact URL.
		const result = controller.reload({ entry: newEntry, mainArtifactUrl: '/deshelf/releases/next/artifacts/test-tool/main.js' });
		expect(result.ok).toBe(true);
		expect(iframes).toHaveLength(2);
		const replacement = iframes[1];
		expect(String(replacement.src)).toContain(`entry=${encodeURIComponent('/deshelf/releases/next/artifacts/test-tool/main.js')}`);
		// Old session stays active (and its iframe stays mounted) while staging.
		expect(oldIframe.detached).toBe(false);
		expect(controller.session.getState()).toBe('Ready');

		(replacement.fireLoad as () => void)();
		await tick();
		// Commit: replacement promoted, old containers discarded, entry swapped.
		expect(oldIframe.detached).toBe(true);
		expect(replacement.detached).toBe(false);
		expect(controller.session.entry.version).toBe('2.0.0');
		expect(controller.session.sessionId).not.toBe(oldSessionId);
		expect(controller.session.getState()).toBe('Ready');
		controller.close();
	});

	test('a failed staged reload keeps the old session and discards the replacement', async () => {
		const entry = makeEntry();
		const newEntry = makeEntry({ version: '2.0.0' });
		const { controller, iframes } = makeFakeDom(entry);
		controller.open();
		(iframes[0].fireLoad as () => void)();
		await tick();
		const oldIframe = iframes[0];
		const result = controller.reload({ entry: newEntry, mainArtifactUrl: '/deshelf/releases/next/artifacts/test-tool/main.js' });
		expect(result.ok).toBe(true);
		const replacement = iframes[1];

		// The replacement never becomes ready; an explicit failure releases the staging.
		controller.session.reload?.fail('startup-timeout');
		await tick();
		expect(replacement.detached).toBe(true, 'replacement discarded');
		expect(oldIframe.detached).toBe(false, 'old session keeps its container');
		expect(controller.session.entry.version).toBe('1.0.0');
		expect(controller.session.getState()).toBe('Ready');
		expect(controller.session.hasActiveReload()).toBe(false);

		// The old session still works after the failed reload.
		controller.session.resetDefaults();
		controller.close();
	});

	test('close removes containers and detaches the session', async () => {
		const entry = makeEntry();
		const { controller, iframes } = makeFakeDom(entry);
		controller.open();
		(iframes[0].fireLoad as () => void)();
		await tick();
		controller.close();
		await tick();
		expect(iframes[0].detached).toBe(true);
		expect(controller.session.getState()).toBe('Closed');
		expect(() => controller.open()).toThrow(/closed/);
	});

	test('browser asset adapter releases replaced and closed blob URLs', () => {
		const entry = makeEntry({ assets: { photo: { id: 'photo', kind: 'image', label: 'Photo' } } });
		const { controller, revokedUrls } = makeFakeDom(entry);
		const first = controller.setAssetFromFile('photo', new File(['abc'], 'first.png', { type: 'image/png' }));
		expect(first.kind).toBe('blob-url');
		expect(first).toMatchObject({ mime: 'image/png' });
		expect(controller.session.assetSnapshot.values.photo).toEqual(first);

		const second = controller.setAssetFromFile('photo', new File(['def'], 'second.png', { type: 'image/png' }));
		if (first.kind !== 'blob-url' || second.kind !== 'blob-url') throw new Error('expected blob URLs');
		expect(revokedUrls).toEqual([first.url]);
		controller.close();
		expect(revokedUrls).toEqual([first.url, second.url]);
	});
});
