export const PREVIEW_CANVAS_FOOTER_MAX_LINES = 5;
export const PREVIEW_CANVAS_FOOTER_WIDTH_EM = 20;

/** @typedef {import('../../ui/pixel-icon/index.js').PixelIconName} PixelIconName */

/** @typedef {'IconOnly' | 'IconAndTitle' | 'TitleOnly'} PreviewCanvasFooterHeaderMode */

/**
 * @typedef {{
 * 	mode: 'IconOnly';
	 * 	icon: PixelIconName;
 * 	iconLabel?: string;
 * }} PreviewCanvasFooterHeaderIconOnly
 */

/**
 * @typedef {{
 * 	mode: 'IconAndTitle';
	 * 	icon: PixelIconName;
 * 	title: string;
 * 	iconLabel?: string;
 * }} PreviewCanvasFooterHeaderIconAndTitle
 */

/**
 * @typedef {{
 * 	mode: 'TitleOnly';
 * 	title: string;
 * }} PreviewCanvasFooterHeaderTitleOnly
 */

/**
 * @typedef {PreviewCanvasFooterHeaderIconOnly | PreviewCanvasFooterHeaderIconAndTitle | PreviewCanvasFooterHeaderTitleOnly} PreviewCanvasFooterHeader
 */

/**
 * @typedef {{ text: string }} PreviewCanvasFooterBodyLine
 */

/**
 * @typedef {{
 * 	header?: PreviewCanvasFooterHeader | null;
 * 	lines?: Array<PreviewCanvasFooterBodyLine | string | null | undefined>;
 * }} PreviewCanvasFooterInfo
 */

/**
 * @typedef {{
 * 	header: PreviewCanvasFooterHeader | null;
 * 	lines: PreviewCanvasFooterBodyLine[];
 * 	widthEm: number;
 * 	maxLines: number;
 * }} NormalizedPreviewCanvasFooterInfo
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
function asTrimmedText(value) {
	if (typeof value !== 'string') {
		if (value === null || value === undefined) {
			return '';
		}
		return String(value).trim();
	}

	return value.trim();
}

/**
 * @param {PixelIconName} icon
 * @param {string} [iconLabel]
 * @returns {PreviewCanvasFooterHeaderIconOnly}
 */
export function footerHeaderIconOnly(icon, iconLabel = '') {
	return {
		mode: 'IconOnly',
		icon,
		iconLabel
	};
}

/**
 * @param {PixelIconName} icon
 * @param {string} title
 * @param {string} [iconLabel]
 * @returns {PreviewCanvasFooterHeaderIconAndTitle}
 */
export function footerHeaderIconAndTitle(icon, title, iconLabel = '') {
	return {
		mode: 'IconAndTitle',
		icon,
		title,
		iconLabel
	};
}

/**
 * @param {string} title
 * @returns {PreviewCanvasFooterHeaderTitleOnly}
 */
export function footerHeaderTitleOnly(title) {
	return {
		mode: 'TitleOnly',
		title
	};
}

/**
 * @param {string} text
 * @returns {PreviewCanvasFooterBodyLine}
 */
export function footerBodyLine(text) {
	return {
		text
	};
}

/**
 * @param {PreviewCanvasFooterInfo} [options]
 * @returns {PreviewCanvasFooterInfo}
 */
export function createPreviewCanvasFooterInfo(options = {}) {
	return {
		header: options.header ?? null,
		lines: Array.isArray(options.lines) ? options.lines : []
	};
}

/**
 * @param {unknown} header
 * @returns {PreviewCanvasFooterHeader | null}
 */
function normalizeHeader(header) {
	if (!header || typeof header !== 'object') {
		return null;
	}

	const mode = asTrimmedText(/** @type {{ mode?: unknown }} */ (header).mode);

	if (mode === 'IconOnly') {
		const icon = asTrimmedText(/** @type {{ icon?: unknown }} */ (header).icon);
		if (!icon) {
			return null;
		}

		const iconLabel = asTrimmedText(/** @type {{ iconLabel?: unknown }} */ (header).iconLabel);
		return {
			mode: 'IconOnly',
			icon,
			iconLabel
		};
	}

	if (mode === 'IconAndTitle') {
		const icon = asTrimmedText(/** @type {{ icon?: unknown }} */ (header).icon);
		const title = asTrimmedText(/** @type {{ title?: unknown }} */ (header).title);
		if (!icon || !title) {
			return null;
		}

		const iconLabel = asTrimmedText(/** @type {{ iconLabel?: unknown }} */ (header).iconLabel);
		return {
			mode: 'IconAndTitle',
			icon,
			title,
			iconLabel
		};
	}

	if (mode === 'TitleOnly') {
		const title = asTrimmedText(/** @type {{ title?: unknown }} */ (header).title);
		if (!title) {
			return null;
		}

		return {
			mode: 'TitleOnly',
			title
		};
	}

	return null;
}

/**
 * @param {unknown} line
 * @returns {PreviewCanvasFooterBodyLine | null}
 */
function normalizeBodyLine(line) {
	if (typeof line === 'string') {
		const text = asTrimmedText(line);
		return text ? { text } : null;
	}

	if (!line || typeof line !== 'object') {
		return null;
	}

	const text = asTrimmedText(/** @type {{ text?: unknown }} */ (line).text);
	return text ? { text } : null;
}

/**
 * @param {PreviewCanvasFooterInfo | null | undefined} footerInfo
 * @returns {NormalizedPreviewCanvasFooterInfo | null}
 */
export function normalizePreviewCanvasFooterInfo(footerInfo) {
	if (!footerInfo) {
		return null;
	}

	const header = normalizeHeader(footerInfo.header);
	const maxBodyLines = header
		? PREVIEW_CANVAS_FOOTER_MAX_LINES - 1
		: PREVIEW_CANVAS_FOOTER_MAX_LINES;
	const sourceLines = Array.isArray(footerInfo.lines) ? footerInfo.lines : [];
	const lines = [];

	for (const line of sourceLines) {
		if (lines.length >= maxBodyLines) {
			break;
		}

		const normalizedLine = normalizeBodyLine(line);
		if (normalizedLine) {
			lines.push(normalizedLine);
		}
	}

	if (!header && lines.length === 0) {
		return null;
	}

	return {
		header,
		lines,
		widthEm: PREVIEW_CANVAS_FOOTER_WIDTH_EM,
		maxLines: PREVIEW_CANVAS_FOOTER_MAX_LINES
	};
}
