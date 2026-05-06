export { triggerDownload } from '../io/download.ts';

const PAD2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

export function defaultExportFilename(toolId: string, date = new Date()): string {
	const stamp =
		`${date.getFullYear()}${PAD2(date.getMonth() + 1)}${PAD2(date.getDate())}` +
		`-${PAD2(date.getHours())}${PAD2(date.getMinutes())}${PAD2(date.getSeconds())}`;
	return `${toolId}-${stamp}`;
}
