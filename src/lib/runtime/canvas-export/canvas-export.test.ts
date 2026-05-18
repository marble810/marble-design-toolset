import assert from 'node:assert/strict';
import test from 'node:test';

import {
	createRegisteredExporterEntry,
	removeRegisteredExporter,
	resolveCapabilities
} from './registry.svelte.ts';
import { extensionFor, RECORDER_MIME_CANDIDATES, pickRecorderMime } from './mime.ts';
import {
	encodePng16,
	exportPng16,
	__resetFastPngForTests,
	__setFastPngForTests
} from './png16.ts';
import { __setHtmlToImageForTests, exportPng8 } from './png.ts';
import { defaultExportFilename } from './download.ts';
import {
	createCanvasExportDiagnostics,
	reconcileExporterSelection,
	resolveActiveExporter,
	runCanvasExportTask,
	type CanvasExportRunState
} from './state.ts';
import { registerCanvasExporterForLifecycle } from './context.ts';
import type {
	CanvasExportContextValue,
	CanvasExporterDescriptor,
	RegisteredExporter
} from '../../types/canvas-export.ts';

// ---------------------------------------------------------------------------
// resolveCapabilities — pure function, covers spec scenarios for capability gating.
// ---------------------------------------------------------------------------

test('resolveCapabilities: dom kind is forced to mp4=false / pngBitDepth=8', () => {
	const dom: CanvasExporterDescriptor = {
		kind: 'dom',
		contentWidth: 100,
		contentHeight: 100,
		getElement: () => null,
		// @ts-expect-error intentional invalid attempt to enable mp4 / 16bit on dom
		capabilities: { mp4: true, pngBitDepth: 16 }
	};
	const resolved = resolveCapabilities(dom);
	assert.equal(resolved.mp4, false);
	assert.equal(resolved.pngBitDepth, 8);
});

test('resolveCapabilities: canvas with getPixels16 + pngBitDepth=16 -> 16', () => {
	const desc: CanvasExporterDescriptor = {
		kind: 'canvas',
		contentWidth: 100,
		contentHeight: 100,
		getCanvas: () => null,
		getPixels16: () => null,
		capabilities: { pngBitDepth: 16 }
	};
	assert.equal(resolveCapabilities(desc).pngBitDepth, 16);
});

test('resolveCapabilities: canvas without getPixels16 + pngBitDepth=16 -> 8 (degraded)', () => {
	const desc: CanvasExporterDescriptor = {
		kind: 'canvas',
		contentWidth: 100,
		contentHeight: 100,
		getCanvas: () => null,
		capabilities: { pngBitDepth: 16 }
	};
	assert.equal(resolveCapabilities(desc).pngBitDepth, 8);
});

test('resolveCapabilities: render with renderFrame16 + pngBitDepth=16 -> 16', () => {
	const desc: CanvasExporterDescriptor = {
		kind: 'render',
		contentWidth: 100,
		contentHeight: 100,
		renderFrame: () => {},
		renderFrame16: async () => ({
			data: new Uint16Array(0),
			width: 0,
			height: 0,
			channels: 4
		}),
		capabilities: { pngBitDepth: 16 }
	};
	assert.equal(resolveCapabilities(desc).pngBitDepth, 16);
});

test('resolveCapabilities: render without renderFrame16 + pngBitDepth=16 -> 8', () => {
	const desc: CanvasExporterDescriptor = {
		kind: 'render',
		contentWidth: 100,
		contentHeight: 100,
		renderFrame: () => {},
		capabilities: { pngBitDepth: 16 }
	};
	assert.equal(resolveCapabilities(desc).pngBitDepth, 8);
});

test('resolveCapabilities: defaults are png=true mp4=true pngBitDepth=8', () => {
	const desc: CanvasExporterDescriptor = {
		kind: 'canvas',
		contentWidth: 100,
		contentHeight: 100,
		getCanvas: () => null
	};
	const resolved = resolveCapabilities(desc);
	assert.deepEqual(resolved, { png: true, mp4: true, pngBitDepth: 8 });
});

test('createRegisteredExporterEntry creates stable ids and labels for selector UI', () => {
	const descriptor = createCanvasDescriptor();
	const first = createRegisteredExporterEntry(
		descriptor,
		{ id: 'Preview Canvas', label: 'Preview Canvas' },
		1
	);
	const second = createRegisteredExporterEntry(
		descriptor,
		{ id: 'Preview Canvas', label: 'Secondary Canvas' },
		2,
		[first.id]
	);

	assert.equal(first.id, 'preview-canvas');
	assert.equal(first.label, 'Preview Canvas');
	assert.equal(second.id, 'preview-canvas-2');
	assert.equal(second.label, 'Secondary Canvas');
});

test('removeRegisteredExporter removes the registered exporter by id', () => {
	const first = createRegisteredExporterEntry(createCanvasDescriptor(), {
		id: 'preview-canvas',
		label: 'Preview Canvas'
	}, 1);
	const second = createRegisteredExporterEntry(createCanvasDescriptor(), {
		id: 'secondary-canvas',
		label: 'Secondary Canvas'
	}, 2);

	assert.deepEqual(removeRegisteredExporter([first, second], first.id), [second]);
});

test('registerCanvasExporterForLifecycle unregisters during lifecycle cleanup', () => {
	const descriptor = createCanvasDescriptor();
	const cleanups: Array<() => void> = [];
	let registerCalls = 0;
	let unregisterCalls = 0;
	const context: CanvasExportContextValue = {
		exporters: [],
		register: (registeredDescriptor, options) => {
			assert.equal(registeredDescriptor, descriptor);
			assert.deepEqual(options, { id: 'preview', label: 'Preview' });
			registerCalls += 1;
			return () => {
				unregisterCalls += 1;
			};
		}
	};

	const unregister = registerCanvasExporterForLifecycle(
		context,
		descriptor,
		(cleanup) => {
			cleanups.push(cleanup);
			return cleanup;
		},
		{ id: 'preview', label: 'Preview' }
	);

	assert.equal(registerCalls, 1);
	assert.equal(unregisterCalls, 0);
	cleanups[0]();
	unregister();
	assert.equal(unregisterCalls, 1);
});

test('exporter selection falls back when the selected exporter disappears', () => {
	const exporters = [createRegisteredExporter('primary', 'Primary'), createRegisteredExporter('alt', 'Alt')];

	assert.equal(resolveActiveExporter(exporters, 'alt')?.id, 'alt');
	assert.deepEqual(reconcileExporterSelection(exporters, ''), {
		selectedExporterId: 'primary',
		selectionLostMessage: ''
	});
	assert.deepEqual(reconcileExporterSelection(exporters, 'missing'), {
		selectedExporterId: 'primary',
		selectionLostMessage: 'Selected exporter is no longer available. Using Primary.'
	});
});

test('createCanvasExportDiagnostics reports missing exporters and capability mismatches', () => {
	const noExporterDiagnostics = createCanvasExportDiagnostics({
		declaredImage: true,
		declaredVideo: false,
		activeExporter: null,
		browserMp4Available: true
	});
	assert.equal(noExporterDiagnostics[0].id, 'missing-exporter');

	const mismatchDiagnostics = createCanvasExportDiagnostics({
		declaredImage: true,
		declaredVideo: true,
		activeExporter: createRegisteredExporter('video-only', 'Video Only', {
			png: false,
			mp4: true,
			pngBitDepth: 8
		}),
		browserMp4Available: false,
		selectionLostMessage: 'Selected exporter is no longer available. Using Video Only.'
	});

	assert.deepEqual(
		mismatchDiagnostics.map((diagnostic) => diagnostic.id),
		['exporter-lost', 'image-unsupported', 'video-browser-unsupported']
	);
});

test('createCanvasExportDiagnostics includes DOM exporter warnings', () => {
	const diagnostics = createCanvasExportDiagnostics({
		declaredImage: true,
		declaredVideo: false,
		activeExporter: {
			id: 'dom',
			label: 'DOM',
			descriptor: {
				kind: 'dom',
				contentWidth: 100,
				contentHeight: 100,
				getElement: () => null,
				getWarnings: () => ['Font fallback used.']
			},
			resolved: { png: true, mp4: false, pngBitDepth: 8 }
		},
		browserMp4Available: true
	});

	assert.equal(diagnostics.at(-1)?.message, 'Font fallback used.');
});

test('exportPng8 maps DOM export options to html-to-image and preserves scale sizing', async () => {
	const originalDocument = globalThis.document;
	const originalHTMLElement = globalThis.HTMLElement;
	const originalTrigger = globalThis.URL;
	const element = {} as HTMLElement;
	let capturedOptions: unknown = null;
	let createdDownload = '';

	(globalThis as { HTMLElement?: unknown }).HTMLElement = class {};
	(globalThis as { document?: unknown }).document = {
		body: { appendChild: () => {} },
		createElement: (tagName: string) => {
			if (tagName === 'a') {
				return {
					href: '',
					download: '',
					click: () => {},
					remove: () => {}
				};
			}
			return {
				width: 0,
				height: 0,
				getContext: () => ({
					imageSmoothingEnabled: false,
					drawImage: () => {}
				}),
				toBlob: (callback: (blob: Blob) => void) => callback(new Blob(['png'], { type: 'image/png' }))
			};
		}
	};
	(globalThis as { URL?: unknown }).URL = {
		createObjectURL: () => {
			createdDownload = 'blob:download';
			return createdDownload;
		},
		revokeObjectURL: () => {}
	};
	__setHtmlToImageForTests({
		toBlob: async (_node, options) => {
			capturedOptions = options;
			return new Blob(['png'], { type: 'image/png' });
		}
	} as unknown as typeof import('html-to-image'));

	try {
		const result = await exportPng8({
			descriptor: {
				kind: 'dom',
				contentWidth: 1080,
				contentHeight: 720,
				getElement: () => element,
				domOptions: {
					backgroundColor: '#fff',
					cacheBust: true,
					style: { overflow: 'hidden' }
				},
				getWarnings: () => ['Font fallback used.']
			},
			contentWidth: 1080,
			contentHeight: 720,
			options: { scale: 4, bitDepth: 8, filename: 'layout' }
		});

		assert.equal(result.ok, true);
		assert.equal(result.warnings?.[0], 'Font fallback used.');
		assert.equal((capturedOptions as { canvasWidth: number }).canvasWidth, 4320);
		assert.equal((capturedOptions as { canvasHeight: number }).canvasHeight, 2880);
		assert.equal((capturedOptions as { pixelRatio: number }).pixelRatio, 4);
		assert.equal((capturedOptions as { backgroundColor: string }).backgroundColor, '#fff');
		assert.equal(createdDownload, 'blob:download');
	} finally {
		__setHtmlToImageForTests(null);
		(globalThis as { document?: unknown }).document = originalDocument;
		(globalThis as { HTMLElement?: unknown }).HTMLElement = originalHTMLElement;
		(globalThis as { URL?: unknown }).URL = originalTrigger;
	}
});

test('exportPng8 wraps DOM filter so non-element nodes do not throw', async () => {
	let capturedFilter: ((node: HTMLElement) => boolean) | undefined;

	__setHtmlToImageForTests({
		toBlob: async (_node, options) => {
			capturedFilter = options?.filter;
			return new Blob(['png'], { type: 'image/png' });
		}
	} as unknown as typeof import('html-to-image'));

	try {
		await exportPng8({
			descriptor: {
				kind: 'dom',
				contentWidth: 100,
				contentHeight: 100,
				getElement: () => ({}) as HTMLElement,
				domOptions: {
					filter: (node) => !node.hasAttribute('data-export-hidden')
				}
			},
			contentWidth: 100,
			contentHeight: 100,
			options: { scale: 1, bitDepth: 8, filename: 'layout' }
		});

		assert.equal(capturedFilter?.({} as HTMLElement), true);
	} finally {
		__setHtmlToImageForTests(null);
	}
});

// ---------------------------------------------------------------------------
// MIME picking
// ---------------------------------------------------------------------------

test('extensionFor maps mp4 / webm correctly', () => {
	assert.equal(extensionFor('video/mp4;codecs=avc1.42E01E'), 'mp4');
	assert.equal(extensionFor('video/webm;codecs=vp9'), 'webm');
});

test('pickRecorderMime: returns null when MediaRecorder is undefined', () => {
	const original = (globalThis as { MediaRecorder?: unknown }).MediaRecorder;
	(globalThis as { MediaRecorder?: unknown }).MediaRecorder = undefined;
	try {
		assert.equal(pickRecorderMime(), null);
	} finally {
		(globalThis as { MediaRecorder?: unknown }).MediaRecorder = original;
	}
});

test('pickRecorderMime: prefers MP4 when supported', () => {
	const original = (globalThis as { MediaRecorder?: unknown }).MediaRecorder;
	(globalThis as { MediaRecorder?: unknown }).MediaRecorder = {
		isTypeSupported: (mime: string) => mime === RECORDER_MIME_CANDIDATES[0]
	};
	try {
		const picked = pickRecorderMime();
		assert.ok(picked);
		assert.equal(picked!.mime, RECORDER_MIME_CANDIDATES[0]);
		assert.equal(picked!.extension, 'mp4');
	} finally {
		(globalThis as { MediaRecorder?: unknown }).MediaRecorder = original;
	}
});

test('pickRecorderMime: falls back to webm vp9 when mp4 is unsupported', () => {
	const original = (globalThis as { MediaRecorder?: unknown }).MediaRecorder;
	(globalThis as { MediaRecorder?: unknown }).MediaRecorder = {
		isTypeSupported: (mime: string) => mime === RECORDER_MIME_CANDIDATES[1]
	};
	try {
		const picked = pickRecorderMime();
		assert.ok(picked);
		assert.equal(picked!.extension, 'webm');
	} finally {
		(globalThis as { MediaRecorder?: unknown }).MediaRecorder = original;
	}
});

// ---------------------------------------------------------------------------
// 16-bit PNG: lazy load + encode contract
// ---------------------------------------------------------------------------

test('encodePng16: lazily invokes fast-png encode with depth=16', async () => {
	__resetFastPngForTests();
	let capturedArgs: unknown = null;
	__setFastPngForTests({
		encode: (args: unknown) => {
			capturedArgs = args;
			return new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
		}
	} as unknown as typeof import('fast-png'));

	const blob = await encodePng16({
		data: new Uint16Array(4 * 2 * 2),
		width: 2,
		height: 2,
		channels: 4
	});

	assert.ok(blob, 'returns a Blob');
	assert.ok(capturedArgs, 'fast-png encode called');
	assert.equal((capturedArgs as { depth: number }).depth, 16);
	assert.equal((capturedArgs as { channels: number }).channels, 4);
	assert.equal((capturedArgs as { width: number }).width, 2);
	__resetFastPngForTests();
});

test('exportPng16: returns error when descriptor lacks 16-bit pixel source', async () => {
	__resetFastPngForTests();
	const desc: CanvasExporterDescriptor = {
		kind: 'canvas',
		contentWidth: 100,
		contentHeight: 100,
		getCanvas: () => null
	};
	const result = await exportPng16({
		descriptor: desc,
		options: { scale: 1, bitDepth: 16, filename: 'test' }
	});
	assert.equal(result.ok, false);
	assert.match(result.error ?? '', /16-bit/);
});

// ---------------------------------------------------------------------------
// Filename generation
// ---------------------------------------------------------------------------

test('defaultExportFilename: produces <toolId>-<yyyymmdd-hhmmss>', () => {
	const date = new Date(2026, 3, 22, 15, 30, 12);
	assert.equal(
		defaultExportFilename('noise-texture-creater', date),
		'noise-texture-creater-20260422-153012'
	);
});

test('runCanvasExportTask toggles busy and records success or failure result', async () => {
	const state: CanvasExportRunState = { busy: false, lastResult: { ok: true, filename: 'old.png' } };
	let sawBusy = false;

	const success = await runCanvasExportTask(state, async () => {
		sawBusy = state.busy;
		return { ok: true, filename: 'new.png' };
	});

	assert.equal(sawBusy, true);
	assert.equal(state.busy, false);
	assert.deepEqual(success, { ok: true, filename: 'new.png' });
	assert.deepEqual(state.lastResult, success);

	const failure = await runCanvasExportTask(state, async () => {
		throw new Error('encode failed');
	});

	assert.equal(state.busy, false);
	assert.equal(failure.ok, false);
	assert.equal(failure.error, 'encode failed');
	assert.deepEqual(state.lastResult, failure);
});

function createCanvasDescriptor(): CanvasExporterDescriptor {
	return {
		kind: 'canvas',
		contentWidth: 100,
		contentHeight: 100,
		getCanvas: () => null
	};
}

function createRegisteredExporter(
	id: string,
	label: string,
	resolved: RegisteredExporter['resolved'] = { png: true, mp4: true, pngBitDepth: 8 }
): RegisteredExporter {
	return {
		id,
		label,
		descriptor: createCanvasDescriptor(),
		resolved
	};
}
