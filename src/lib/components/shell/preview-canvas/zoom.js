/** @typedef {'Fit' | '1:1'} PreviewCanvasDefaultZoom */
/** @typedef {'fit' | 'manual'} PreviewCanvasMode */

const MIN_PREVIEW_CANVAS_ZOOM = 0.1;
const MAX_PREVIEW_CANVAS_ZOOM = 16;

/**
 * @param {PreviewCanvasDefaultZoom} defaultZoom
 * @returns {PreviewCanvasMode}
 */
export function resolvePreviewCanvasDefaultMode(defaultZoom) {
	return defaultZoom === '1:1' ? 'manual' : 'fit';
}

/**
 * @param {number} zoom
 * @returns {number}
 */
export function clampPreviewCanvasZoom(zoom) {
	return Math.min(MAX_PREVIEW_CANVAS_ZOOM, Math.max(MIN_PREVIEW_CANVAS_ZOOM, zoom));
}

/**
 * @param {{
 * 	viewportWidth: number;
 * 	viewportHeight: number;
 * 	contentWidth: number;
 * 	contentHeight: number;
 * 	devicePixelRatio: number;
 * 	padding: number;
 * }} options
 * @returns {number}
 */
export function computePreviewCanvasFitZoom({
	viewportWidth,
	viewportHeight,
	contentWidth,
	contentHeight,
	devicePixelRatio,
	padding
}) {
	if (!viewportWidth || !viewportHeight || !contentWidth || !contentHeight || !devicePixelRatio) {
		return 1;
	}

	const availableWidth = Math.max((viewportWidth - padding) * devicePixelRatio, 1);
	const availableHeight = Math.max((viewportHeight - padding) * devicePixelRatio, 1);

	return Math.min(availableWidth / contentWidth, availableHeight / contentHeight);
}

/**
 * @param {number} logicalZoom
 * @param {number} devicePixelRatio
 * @returns {number}
 */
export function computePreviewCanvasRenderScale(logicalZoom, devicePixelRatio) {
	return logicalZoom / (devicePixelRatio || 1);
}