import test from 'node:test';
import assert from 'node:assert/strict';

import {
	clampPreviewCanvasZoom,
	computePreviewCanvasFitZoom,
	computePreviewCanvasRenderScale,
	resolvePreviewCanvasDefaultMode
} from './zoom.js';

test('resolvePreviewCanvasDefaultMode maps Fit and 1:1 to internal modes', () => {
	assert.equal(resolvePreviewCanvasDefaultMode('Fit'), 'fit');
	assert.equal(resolvePreviewCanvasDefaultMode('1:1'), 'manual');
});

test('computePreviewCanvasRenderScale normalizes logical zoom by devicePixelRatio', () => {
	assert.equal(computePreviewCanvasRenderScale(1, 1.25), 0.8);
	assert.equal(computePreviewCanvasRenderScale(2, 2), 1);
});

test('computePreviewCanvasFitZoom calculates logical fit zoom in device-pixel space', () => {
	const fitZoom = computePreviewCanvasFitZoom({
		viewportWidth: 800,
		viewportHeight: 600,
		contentWidth: 512,
		contentHeight: 512,
		devicePixelRatio: 1.25,
		padding: 72
	});

	assert.equal(fitZoom, Math.min((728 * 1.25) / 512, (528 * 1.25) / 512));
});

test('clampPreviewCanvasZoom keeps logical zoom inside supported bounds', () => {
	assert.equal(clampPreviewCanvasZoom(0.02), 0.1);
	assert.equal(clampPreviewCanvasZoom(32), 16);
	assert.equal(clampPreviewCanvasZoom(1.5), 1.5);
});