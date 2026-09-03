/**
 * Desktop AppData cache layout (Deshelf Forge for Desktop).
 *
 * Everything the Desktop Forge produces lives under one injected root (the real app
 * passes Electron's `userData` directory; tests pass a temp dir). Nothing is ever
 * written back into the Tool Project except the `.deshelf/` IDE declarations, which are
 * the Tool author's project-local, gitignored generated dir.
 *
 *   <cacheRoot>/
 *     catalogs/<projectLocationId>.json     Desktop Project Catalog (per Location)
 *     catalogs/index.json                   Location index for the Host UI
 *     builds/<projectLocationId>/<sourceHash>/   immutable successful build outputs
 *     tmp/<name>/                           staging trees, removed after publish/fail
 *
 * Builds are keyed by a content hash of the Tool Project sources, so an unchanged
 * project rebuilds to the same directory and is served straight from cache.
 */
import path from 'node:path';

export interface DesktopCachePaths {
	root: string;
	catalogs: string;
	catalogIndex: string;
	builds: string;
	tmp: string;
}

export function createCachePaths(cacheRoot: string): DesktopCachePaths {
	return {
		root: cacheRoot,
		catalogs: path.join(cacheRoot, 'catalogs'),
		catalogIndex: path.join(cacheRoot, 'catalogs', 'index.json'),
		builds: path.join(cacheRoot, 'builds'),
		tmp: path.join(cacheRoot, 'tmp')
	};
}

export function buildDirFor(paths: DesktopCachePaths, projectLocationId: string, sourceHash: string): string {
	return path.join(paths.builds, projectLocationId, sourceHash);
}

export function tmpDirFor(paths: DesktopCachePaths, name: string): string {
	return path.join(paths.tmp, name);
}

/** Container page + artifact URLs are served through this protocol from the cache. */
export const CACHE_PROTOCOL = 'deshelf-cache';

/**
 * Absolute cache paths never cross into any renderer: renderers only ever see
 * `deshelf-cache://<relative-path-under-cacheRoot>` URLs.
 */
export function cacheUrlFor(relativePath: string): string {
	const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
	return `${CACHE_PROTOCOL}://${normalized}`;
}
