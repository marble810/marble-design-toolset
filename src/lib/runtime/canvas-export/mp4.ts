import type {
	CanvasExporterDescriptor,
	ExportResult,
	Mp4ExportOptions
} from '$lib/types/canvas-export';
import { pickRecorderMime, type PickedMime } from './mime.ts';
import { triggerDownload } from './download.ts';

interface MediaRecorderLike {
	start: (timeslice?: number) => void;
	stop: () => void;
	ondataavailable: ((event: BlobEvent) => void) | null;
	onstop: (() => void) | null;
	onerror: ((event: Event) => void) | null;
	state: string;
}

interface RecorderConstructor {
	new (stream: MediaStream, options?: { mimeType?: string }): MediaRecorderLike;
}

function getRecorderConstructor(): RecorderConstructor | null {
	if (typeof MediaRecorder === 'undefined') {
		return null;
	}
	return MediaRecorder as unknown as RecorderConstructor;
}

interface RecordCanvasArgs {
	canvas: HTMLCanvasElement;
	picked: PickedMime;
	totalFrames: number;
	fps: number;
	driveFrame?: (frameIndex: number, time: number) => void | Promise<void>;
}

async function recordWithMediaRecorder(args: RecordCanvasArgs): Promise<{ blob: Blob }> {
	const Recorder = getRecorderConstructor();
	if (!Recorder) {
		throw new Error('MediaRecorder is not available in this browser');
	}

	const isManual = typeof args.driveFrame === 'function';
	const stream = args.canvas.captureStream(isManual ? 0 : args.fps);
	const recorder = new Recorder(stream, { mimeType: args.picked.mime });
	const chunks: Blob[] = [];

	const stopped = new Promise<void>((resolve, reject) => {
		recorder.ondataavailable = (event) => {
			if (event.data && event.data.size > 0) {
				chunks.push(event.data);
			}
		};
		recorder.onstop = () => resolve();
		recorder.onerror = (event) => reject(event);
	});

	recorder.start();

	try {
		if (isManual) {
			const track = stream.getVideoTracks()[0] as
				| (MediaStreamTrack & { requestFrame?: () => void })
				| undefined;
			const intervalMs = 1000 / args.fps;
			for (let i = 0; i < args.totalFrames; i += 1) {
				const time = i * intervalMs;
				await args.driveFrame!(i, time);
				track?.requestFrame?.();
				if (i < args.totalFrames - 1) {
					await new Promise<void>((r) => setTimeout(r, intervalMs));
				}
			}
		} else {
			const totalMs = (args.totalFrames / args.fps) * 1000;
			await new Promise<void>((r) => setTimeout(r, totalMs));
		}
	} catch (err) {
		try {
			if (recorder.state !== 'inactive') {
				recorder.stop();
			}
		} catch {
			// noop
		}
		throw err;
	}

	if (recorder.state !== 'inactive') {
		recorder.stop();
	}
	await stopped;
	stream.getTracks().forEach((track) => track.stop());

	return { blob: new Blob(chunks, { type: args.picked.mime }) };
}

export async function exportMp4(args: {
	descriptor: CanvasExporterDescriptor;
	contentWidth: number;
	contentHeight: number;
	options: Mp4ExportOptions;
}): Promise<ExportResult> {
	const { descriptor, contentWidth, contentHeight, options } = args;
	const picked = pickRecorderMime();
	if (!picked) {
		return {
			ok: false,
			error: 'No supported video MIME type for MediaRecorder in this browser'
		};
	}
	if (descriptor.kind === 'dom') {
		return {
			ok: false,
			error: 'DOM exporters do not support video export'
		};
	}

	const filename = `${options.filename || 'export'}.${picked.extension}`;
	const totalFrames = Math.max(1, Math.round(options.fps * options.durationSeconds));

	try {
		let recordCanvas: HTMLCanvasElement;
		let driveFrame: ((index: number, time: number) => Promise<void>) | undefined;

		if (descriptor.kind === 'canvas') {
			const source = descriptor.getCanvas();
			if (!source) {
				return { ok: false, error: 'Source canvas is not available' };
			}
			recordCanvas = source;
		} else {
			const target = document.createElement('canvas');
			target.width = Math.max(1, Math.floor(contentWidth * options.scale));
			target.height = Math.max(1, Math.floor(contentHeight * options.scale));
			recordCanvas = target;
			const renderFrame = descriptor.renderFrame;
			driveFrame = async (frameIndex, time) => {
				await renderFrame({ canvas: target, time, frameIndex });
			};
		}

		const { blob } = await recordWithMediaRecorder({
			canvas: recordCanvas,
			picked,
			totalFrames,
			fps: options.fps,
			driveFrame
		});

		triggerDownload(blob, filename);

		return {
			ok: true,
			filename,
			mime: picked.mime,
			extension: picked.extension,
			notice:
				picked.extension === 'mp4'
					? undefined
					: `MP4 not supported in this browser. File saved as ${picked.extension.toUpperCase()} (${picked.mime}).`
		};
	} catch (err) {
		return {
			ok: false,
			error: err instanceof Error ? err.message : String(err)
		};
	}
}
