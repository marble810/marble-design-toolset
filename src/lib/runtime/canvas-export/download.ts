/** Trigger a browser download for a Blob with the given filename. */
export function triggerDownload(blob: Blob, filename: string): void {
	if (typeof document === 'undefined') {
		return;
	}
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	// Defer revoke so the browser has a chance to start the download stream.
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const PAD2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

export function defaultExportFilename(toolId: string, date = new Date()): string {
	const stamp =
		`${date.getFullYear()}${PAD2(date.getMonth() + 1)}${PAD2(date.getDate())}` +
		`-${PAD2(date.getHours())}${PAD2(date.getMinutes())}${PAD2(date.getSeconds())}`;
	return `${toolId}-${stamp}`;
}
