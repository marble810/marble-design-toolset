import type { ImportedFileItem } from '$lib/types/file-input';

export interface ImportedFileSummary {
	name: string;
	kind: ImportedFileItem['kind'];
	kindLabel: string;
	sizeLabel: string;
	detail: string;
}

export function formatFileSize(size: number): string {
	if (!Number.isFinite(size) || size <= 0) return '0 B';
	if (size < 1024) return `${size} B`;
	if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
	return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
	const minutes = Math.floor(seconds / 60);
	const wholeSeconds = Math.round(seconds % 60);
	return `${minutes}:${wholeSeconds < 10 ? `0${wholeSeconds}` : wholeSeconds}`;
}

export function summarizeImportedFileItem(item: ImportedFileItem): ImportedFileSummary {
	const sizeLabel = formatFileSize(item.size);

	if (item.kind === 'image') {
		return {
			name: item.name,
			kind: item.kind,
			kindLabel: 'Image',
			sizeLabel,
			detail: `${item.width} x ${item.height} px · ${sizeLabel}`
		};
	}

	if (item.kind === 'video') {
		return {
			name: item.name,
			kind: item.kind,
			kindLabel: 'Video',
			sizeLabel,
			detail: `${item.width} x ${item.height} px · ${formatDuration(item.duration)} · ${sizeLabel}`
		};
	}

	if (item.kind === 'font') {
		return {
			name: item.name,
			kind: item.kind,
			kindLabel: 'Font',
			sizeLabel,
			detail: `Font file · ${sizeLabel}`
		};
	}

	return {
		name: item.name,
		kind: item.kind,
		kindLabel: 'Text',
		sizeLabel,
		detail: `${item.text.length} chars · ${sizeLabel}`
	};
}
