import assert from 'node:assert/strict';
import test from 'node:test';

import { formatDuration, formatFileSize, summarizeImportedFileItem } from './summary.ts';

test('formatFileSize formats bytes, KB, and MB', () => {
	assert.equal(formatFileSize(12), '12 B');
	assert.equal(formatFileSize(1536), '1.5 KB');
	assert.equal(formatFileSize(2 * 1024 * 1024), '2.0 MB');
});

test('formatDuration formats media duration', () => {
	assert.equal(formatDuration(4.2), '0:04');
	assert.equal(formatDuration(65), '1:05');
});

test('summarizeImportedFileItem creates stable summaries for source UI', () => {
	const file = new File(['pixels'], 'texture.png', { type: 'image/png' });
	const summary = summarizeImportedFileItem({
		kind: 'image',
		source: 'drop',
		file,
		name: file.name,
		mimeType: file.type,
		size: file.size,
		lastModified: file.lastModified,
		objectUrl: 'blob:texture',
		width: 256,
		height: 128
	});

	assert.equal(summary.name, 'texture.png');
	assert.equal(summary.kindLabel, 'Image');
	assert.match(summary.detail, /256 x 128 px/);
});