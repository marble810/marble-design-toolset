/**
 * Deterministic Visual Output encoding (Main Container only).
 *
 * The preview rAF loop is wall-clock driven, but exports replay the simulation from
 * frame 0 in an offscreen renderer so every exported frame matches the deterministic
 * step sequence — the same contract the old tool's `renderFrame(canvas, frameIndex)`
 * exporter guaranteed. Encoding happens here in the Container (frozen decision: render/
 * encode in Main); the Host only receives the finished Blob and downloads it.
 *
 * Export shape (legacy parity): still = simulation frame 0; video = 90 logical frames
 * @ 30 fps recorded through MediaRecorder with manual `requestFrame()` pacing.
 */
import type { SimParameters } from '../parameters.ts';
import { ShallowWaterWaveRenderer } from './renderer.ts';

export const VIDEO_EXPORT_FPS = 30;
export const VIDEO_EXPORT_SECONDS = 3;

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
	if (typeof MediaRecorder === 'undefined') return false;
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

function canvasToBlob(canvas: HTMLCanvasElement, mime = 'image/png'): Promise<Blob> {
	return new Promise<Blob>((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (blob === null) {
				reject(new Error('canvas.toBlob returned null'));
				return;
			}
			resolve(blob);
		}, mime);
	});
}

function createOffscreenCanvas(size: number): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.floor(size));
	canvas.height = Math.max(1, Math.floor(size));
	return canvas;
}

/**
 * Still export: the deterministic frame 0 (initial height field through the display
 * shader) at the current simulation resolution — identical to the legacy PNG export.
 */
export async function exportStillBlob(sim: SimParameters, initialData: Float32Array): Promise<Blob> {
	const canvas = createOffscreenCanvas(sim.resolution);
	const renderer = new ShallowWaterWaveRenderer(canvas, sim.resolution);
	try {
		renderer.setInitialHeight(initialData);
		renderer.render(sim);
		return await canvasToBlob(canvas);
	} finally {
		renderer.dispose();
	}
}

interface ManualRecorder {
	start(): void;
	stop(): void;
}

/** MediaRecorder capture with manual frame pacing (deterministic, not wall-clock). */
async function recordDeterministicFrames(
	canvas: HTMLCanvasElement,
	picked: PickedMime,
	totalFrames: number,
	fps: number,
	driveFrame: (frameIndex: number) => Promise<void>
): Promise<Blob> {
	if (typeof MediaRecorder === 'undefined') {
		throw new Error('MediaRecorder is not available in this browser');
	}
	const stream = canvas.captureStream(0);
	const recorder = new MediaRecorder(stream, { mimeType: picked.mime }) as unknown as ManualRecorder & {
		ondataavailable: ((event: BlobEvent) => void) | null;
		onstop: (() => void) | null;
		onerror: ((event: Event) => void) | null;
		state: string;
	};
	const chunks: Blob[] = [];
	const stopped = new Promise<void>((resolve, reject) => {
		recorder.ondataavailable = (event) => {
			if (event.data && event.data.size > 0) chunks.push(event.data);
		};
		recorder.onstop = () => resolve();
		recorder.onerror = (event) => reject(new Error(`MediaRecorder failed: ${String((event as ErrorEvent).message ?? 'unknown error')}`));
	});

	recorder.start();
	try {
		const track = stream.getVideoTracks()[0] as (MediaStreamTrack & { requestFrame?: () => void }) | undefined;
		const intervalMs = 1000 / fps;
		for (let index = 0; index < totalFrames; index += 1) {
			await driveFrame(index);
			track?.requestFrame?.();
			if (index < totalFrames - 1) {
				await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
			}
		}
	} catch (err) {
		try {
			if (recorder.state !== 'inactive') recorder.stop();
		} catch {
			// recorder teardown must not mask the original failure
		}
		await stopped.catch(() => {});
		stream.getTracks().forEach((track) => track.stop());
		throw err;
	}

	if (recorder.state !== 'inactive') recorder.stop();
	await stopped;
	stream.getTracks().forEach((track) => track.stop());
	return new Blob(chunks, { type: picked.mime });
}

/**
 * Video export: deterministic replay from frame 0 (90 logical frames @ 30 fps by
 * default), recorded at the simulation resolution.
 */
export async function exportVideoBlob(
	sim: SimParameters,
	initialData: Float32Array,
	options: { fps: number; seconds: number } = { fps: VIDEO_EXPORT_FPS, seconds: VIDEO_EXPORT_SECONDS }
): Promise<{ blob: Blob; extension: 'mp4' | 'webm' }> {
	const picked = pickRecorderMime();
	if (picked === null) {
		throw new Error('No supported video MIME type for MediaRecorder in this browser');
	}

	const canvas = createOffscreenCanvas(sim.resolution);
	const renderer = new ShallowWaterWaveRenderer(canvas, sim.resolution);
	try {
		renderer.setInitialHeight(initialData);
		const totalFrames = Math.max(1, Math.round(options.fps * options.seconds));
		const blob = await recordDeterministicFrames(canvas, picked, totalFrames, options.fps, async (frameIndex) => {
			// Frame 0 is the initial state; every later frame advances exactly one
			// logical frame so the replay matches the preview's deterministic stepping.
			if (frameIndex > 0) renderer.advanceFrames(1, sim);
			renderer.render(sim);
		});
		return { blob, extension: picked.extension };
	} finally {
		renderer.dispose();
	}
}
