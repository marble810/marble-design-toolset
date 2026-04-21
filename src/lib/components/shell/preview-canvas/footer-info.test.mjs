import test from 'node:test';
import assert from 'node:assert/strict';

import {
	PREVIEW_CANVAS_FOOTER_MAX_LINES,
	PREVIEW_CANVAS_FOOTER_WIDTH_EM,
	createPreviewCanvasFooterInfo,
	footerBodyLine,
	footerHeaderIconAndTitle,
	footerHeaderIconOnly,
	footerHeaderTitleOnly,
	normalizePreviewCanvasFooterInfo
} from './footer-info.js';

test('header helper functions create expected header modes', () => {
	assert.deepEqual(footerHeaderIconOnly('sparkles', 'Decoration'), {
		mode: 'IconOnly',
		icon: 'sparkles',
		iconLabel: 'Decoration'
	});

	assert.deepEqual(footerHeaderIconAndTitle('info-box', 'Noise Info'), {
		mode: 'IconAndTitle',
		icon: 'info-box',
		title: 'Noise Info',
		iconLabel: ''
	});

	assert.deepEqual(footerHeaderTitleOnly('Preview Details'), {
		mode: 'TitleOnly',
		title: 'Preview Details'
	});
});

test('normalize returns null when no valid header and no valid lines', () => {
	assert.equal(normalizePreviewCanvasFooterInfo(null), null);
	assert.equal(normalizePreviewCanvasFooterInfo({}), null);
	assert.equal(
		normalizePreviewCanvasFooterInfo({
			header: { mode: 'TitleOnly', title: '   ' },
			lines: ['   ']
		}),
		null
	);
});

test('normalize limits total rows to five with header + body lines', () => {
	const footerInfo = createPreviewCanvasFooterInfo({
		header: footerHeaderIconAndTitle('info-box', 'Frame Metadata'),
		lines: [
			footerBodyLine('Line 1'),
			footerBodyLine('Line 2'),
			footerBodyLine('Line 3'),
			footerBodyLine('Line 4'),
			footerBodyLine('Line 5')
		]
	});

	const normalized = normalizePreviewCanvasFooterInfo(footerInfo);
	assert.ok(normalized);
	assert.equal(normalized?.header?.mode, 'IconAndTitle');
	assert.equal(normalized?.lines.length, PREVIEW_CANVAS_FOOTER_MAX_LINES - 1);
	assert.deepEqual(
		normalized?.lines.map((line) => line.text),
		['Line 1', 'Line 2', 'Line 3', 'Line 4']
	);
	assert.equal(normalized?.widthEm, PREVIEW_CANVAS_FOOTER_WIDTH_EM);
});

test('normalize allows five body lines when no header exists', () => {
	const normalized = normalizePreviewCanvasFooterInfo({
		lines: ['A', 'B', 'C', 'D', 'E', 'F']
	});

	assert.ok(normalized);
	assert.equal(normalized?.header, null);
	assert.equal(normalized?.lines.length, PREVIEW_CANVAS_FOOTER_MAX_LINES);
	assert.deepEqual(
		normalized?.lines.map((line) => line.text),
		['A', 'B', 'C', 'D', 'E']
	);
});

test('normalize silently trims invalid entries and invalid header', () => {
	const normalized = normalizePreviewCanvasFooterInfo({
		header: { mode: 'IconAndTitle', icon: '', title: 'Missing Icon' },
		lines: ['  Keep me  ', null, '', { text: '  Keep object text  ' }, { text: '   ' }]
	});

	assert.ok(normalized);
	assert.equal(normalized?.header, null);
	assert.deepEqual(
		normalized?.lines.map((line) => line.text),
		['Keep me', 'Keep object text']
	);
});
