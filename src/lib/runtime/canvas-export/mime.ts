export const RECORDER_MIME_CANDIDATES = [
	'video/mp4;codecs=avc1.42E01E',
	'video/webm;codecs=vp9',
	'video/webm;codecs=vp8'
] as const;

export type RecorderMime = (typeof RECORDER_MIME_CANDIDATES)[number];

export interface PickedMime {
	mime: RecorderMime;
	extension: 'mp4' | 'webm';
}

function isTypeSupported(mime: string): boolean {
	if (typeof MediaRecorder === 'undefined') {
		return false;
	}
	try {
		return MediaRecorder.isTypeSupported(mime);
	} catch {
		return false;
	}
}

export function extensionFor(mime: string): 'mp4' | 'webm' {
	return mime.startsWith('video/mp4') ? 'mp4' : 'webm';
}

export function pickRecorderMime(): PickedMime | null {
	for (const candidate of RECORDER_MIME_CANDIDATES) {
		if (isTypeSupported(candidate)) {
			return { mime: candidate, extension: extensionFor(candidate) };
		}
	}
	return null;
}

export function isMp4ExportAvailable(): boolean {
	return pickRecorderMime() !== null;
}
