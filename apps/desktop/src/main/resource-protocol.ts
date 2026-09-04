/**
 * `deshelf-cache://` protocol: read-only serving of the AppData cache (build artifacts,
 * library bundles, container pages, session asset bytes) to renderers.
 *
 * Registered as a standard, secure, fetch-capable scheme so the container page can use
 * ES module import maps and fetch asset bytes. Renderers never receive Windows/POSIX
 * paths — they only see opaque `deshelf-cache://…` URLs whose mapping lives here.
 */
import path from 'node:path';
import { createCachePaths, CACHE_PROTOCOL } from './paths.ts';
import type { SessionAssetStore } from './asset-store.ts';

/** Privileged scheme registration (must run before `app.ready`). */
export function privilegedCacheScheme(): { scheme: string; privileges: Record<string, boolean> } {
	return {
		scheme: CACHE_PROTOCOL,
		privileges: {
			standard: true,
			secure: true,
			supportFetchAPI: true,
			stream: true
		}
	};
}

const CONTENT_TYPES: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.webp': 'image/webp',
	'.gif': 'image/gif',
	'.svg': 'image/svg+xml',
	'.woff2': 'font/woff2',
	'.bin': 'application/octet-stream'
};

export function contentTypeFor(filePath: string): string {
	return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

export interface ResolvedSessionAsset {
	bytes: Uint8Array;
	contentType: string;
}

/** Resolves an opaque session asset URL without exposing or probing filesystem paths. */
export function resolveSessionAssetUrl(
	store: SessionAssetStore,
	rawUrl: string
): ResolvedSessionAsset | undefined {
	let url: URL;
	try {
		url = new URL(rawUrl);
	} catch {
		return undefined;
	}
	if (url.protocol !== `${CACHE_PROTOCOL}:` || url.host !== 'session-assets') return undefined;
	const segments = url.pathname.replace(/^\/+/, '').split('/');
	if (segments.length !== 2) return undefined;
	const [encodedSessionId, handle] = segments;
	let sessionId: string;
	try {
		sessionId = decodeURIComponent(encodedSessionId as string);
	} catch {
		return undefined;
	}
	const asset = store.get(handle as string);
	if (asset === undefined || asset.sessionId !== sessionId) return undefined;
	return { bytes: asset.bytes, contentType: asset.mime };
}

export interface ResolvedCacheUrl {
	/** Absolute path under the cache root (Main-process only). */
	absolutePath: string;
	contentType: string;
}

/**
 * Maps a `deshelf-cache://<host>/<path>` URL onto the cache root. Path traversal
 * (`..`, encoded separators, absolute segments, non-build hosts) is rejected with
 * `undefined` — the protocol handler answers 404, never a filesystem probe.
 */
export function resolveCacheUrl(cacheRoot: string, rawUrl: string): ResolvedCacheUrl | undefined {
	let url: URL;
	try {
		url = new URL(rawUrl);
	} catch {
		return undefined;
	}
	if (url.protocol !== `${CACHE_PROTOCOL}:`) return undefined;
	// Single namespace: `deshelf-cache://builds/<relative path under builds/>`.
	if (url.host !== 'builds') return undefined;
	const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
	if (relative.length === 0) return undefined;
	const segments = relative.split('/');
	if (segments.some((segment) => segment === '' || segment === '.' || segment === '..' || segment.includes('\\'))) {
		return undefined;
	}
	const paths = createCachePaths(cacheRoot);
	const absolutePath = path.join(paths.root, 'builds', ...segments);
	// Defense in depth: the resolved path must still live inside the cache root.
	const rootWithSep = paths.root.endsWith(path.sep) ? paths.root : paths.root + path.sep;
	if (!absolutePath.startsWith(rootWithSep)) return undefined;
	return { absolutePath, contentType: contentTypeFor(absolutePath) };
}
