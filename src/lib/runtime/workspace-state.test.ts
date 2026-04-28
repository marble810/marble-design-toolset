import assert from 'node:assert/strict';
import test from 'node:test';

import {
	activateWorkspaceToolSelection,
	closeWorkspaceToolSelection,
	DEFAULT_LEFT_PANEL_WIDTH_VW,
	persistWorkspaceState,
	resolveInitialWorkspaceState
} from './workspace-state.ts';

type WindowLike = typeof window;

function installWindowMock(options?: { storageValue?: string | null; hash?: string }) {
	const storage = new Map<string, string>();
	if (options?.storageValue != null) {
		storage.set('marble-design-toolset:workspace', options.storageValue);
	}

	const replaceStateCalls: string[] = [];
	const windowMock = {
		location: {
			pathname: '/index.html',
			search: '',
			hash: options?.hash ?? ''
		},
		history: {
			state: null,
			replaceState(_state: unknown, _title: string, url: string) {
				replaceStateCalls.push(url);
			}
		},
		localStorage: {
			getItem(key: string) {
				return storage.get(key) ?? null;
			},
			setItem(key: string, value: string) {
				storage.set(key, value);
			}
		}
	} as unknown as WindowLike;

	const originalWindow = globalThis.window;
	Object.defineProperty(globalThis, 'window', {
		value: windowMock,
		configurable: true,
		writable: true
	});

	return {
		storage,
		replaceStateCalls,
		restore() {
			if (originalWindow === undefined) {
				delete (globalThis as { window?: WindowLike }).window;
				return;
			}

			Object.defineProperty(globalThis, 'window', {
				value: originalWindow,
				configurable: true,
				writable: true
			});
		}
	};
}

test('resolveInitialWorkspaceState keeps first load empty when no storage and no hash exist', () => {
	const mock = installWindowMock();

	try {
		assert.deepStrictEqual(resolveInitialWorkspaceState(['noise-texture-creater']), {
			openToolIds: [],
			activeToolId: null,
			leftPanelWidthVw: DEFAULT_LEFT_PANEL_WIDTH_VW
		});
	} finally {
		mock.restore();
	}
});

test('activateWorkspaceToolSelection appends a newly opened tool and makes it active', () => {
	assert.deepStrictEqual(
		activateWorkspaceToolSelection(
			{
				openToolIds: ['aspect-ratio'],
				activeToolId: 'aspect-ratio'
			},
			'noise-texture-creater'
		),
		{
			openToolIds: ['aspect-ratio', 'noise-texture-creater'],
			activeToolId: 'noise-texture-creater'
		}
	);
});

test('activateWorkspaceToolSelection reuses an open session instead of duplicating the tool id', () => {
	assert.deepStrictEqual(
		activateWorkspaceToolSelection(
			{
				openToolIds: ['aspect-ratio', 'noise-texture-creater'],
				activeToolId: 'noise-texture-creater'
			},
			'aspect-ratio'
		),
		{
			openToolIds: ['aspect-ratio', 'noise-texture-creater'],
			activeToolId: 'aspect-ratio'
		}
	);
});

test('closeWorkspaceToolSelection removes a closed active tool and promotes the nearest remaining tab', () => {
	assert.deepStrictEqual(
		closeWorkspaceToolSelection(
			{
				openToolIds: ['aspect-ratio', 'noise-texture-creater', 'hello-world'],
				activeToolId: 'noise-texture-creater'
			},
			'noise-texture-creater'
		),
		{
			openToolIds: ['aspect-ratio', 'hello-world'],
			activeToolId: 'hello-world'
		}
	);
});

test('closeWorkspaceToolSelection clears the active tool when the last tab closes', () => {
	assert.deepStrictEqual(
		closeWorkspaceToolSelection(
			{
				openToolIds: ['noise-texture-creater'],
				activeToolId: 'noise-texture-creater'
			},
			'noise-texture-creater'
		),
		{
			openToolIds: [],
			activeToolId: null
		}
	);
});

test('resolveInitialWorkspaceState adds a valid hash tool to the restored open tabs', () => {
	const mock = installWindowMock({
		storageValue: JSON.stringify({
			openToolIds: ['aspect-ratio'],
			activeToolId: 'aspect-ratio',
			leftPanelWidthVw: 31
		}),
		hash: '#noise-texture-creater'
	});

	try {
		assert.deepStrictEqual(resolveInitialWorkspaceState(['aspect-ratio', 'noise-texture-creater']), {
			openToolIds: ['aspect-ratio', 'noise-texture-creater'],
			activeToolId: 'noise-texture-creater',
			leftPanelWidthVw: 31
		});
	} finally {
		mock.restore();
	}
});

test('persistWorkspaceState writes the restored tabs without changing the storage schema', () => {
	const mock = installWindowMock();

	try {
		persistWorkspaceState({
			openToolIds: ['noise-texture-creater', 'aspect-ratio'],
			activeToolId: 'aspect-ratio',
			leftPanelWidthVw: 999
		});

		assert.equal(
			mock.storage.get('marble-design-toolset:workspace'),
			JSON.stringify({
				openToolIds: ['noise-texture-creater', 'aspect-ratio'],
				activeToolId: 'aspect-ratio',
				leftPanelWidthVw: 40
			})
		);
	} finally {
		mock.restore();
	}
});