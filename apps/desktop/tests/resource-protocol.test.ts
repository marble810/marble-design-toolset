/**
 * Cache URL resolver tests: the ONLY place `deshelf-cache://` URLs become real paths —
 * and the place that must reject every traversal attempt.
 */
import { describe, expect, test } from 'bun:test';
import os from 'node:os';
import path from 'node:path';
import { cacheUrlFor } from '../src/main/paths.ts';
import { contentTypeFor, resolveCacheUrl } from '../src/main/resource-protocol.ts';

const CACHE_ROOT = path.join(os.tmpdir(), 'deshelf-desktop-protocol-test');

describe('resolveCacheUrl', () => {
	test('maps well-formed URLs inside the cache root', () => {
		const resolved = resolveCacheUrl(CACHE_ROOT, 'deshelf-cache://builds/loc-a/abc123/container.html');
		expect(resolved?.absolutePath.toLowerCase()).toBe(path.join(CACHE_ROOT, 'builds', 'loc-a', 'abc123', 'container.html').toLowerCase());
		expect(resolved?.contentType).toBe('text/html; charset=utf-8');
		expect(contentTypeFor('x.js')).toBe('text/javascript; charset=utf-8');
	});

	test('rejects traversal, foreign hosts, backslashes, empty and foreign URLs', () => {
		// The URL parser consumes literal `../..` before we see it, collapsing to a
		// harmless path that stays inside the cache root — still no escape.
		const normalized = resolveCacheUrl(CACHE_ROOT, 'deshelf-cache://builds/../../etc/passwd');
		expect(normalized?.absolutePath.toLowerCase().startsWith(CACHE_ROOT.toLowerCase())).toBe(true);
		// Percent-encoded traversal survives decoding and IS rejected outright.
		expect(resolveCacheUrl(CACHE_ROOT, 'deshelf-cache://builds/a%2F%2E%2E/b')).toBeUndefined();
		expect(resolveCacheUrl(CACHE_ROOT, 'deshelf-cache://builds/x\\y')).toBeUndefined();
		expect(resolveCacheUrl(CACHE_ROOT, 'deshelf-cache://')).toBeUndefined();
		expect(resolveCacheUrl(CACHE_ROOT, 'deshelf-cache://session-assets/some-handle')).toBeUndefined();
		expect(resolveCacheUrl(CACHE_ROOT, 'file:///C:/Windows/system32')).toBeUndefined();
		expect(resolveCacheUrl(CACHE_ROOT, 'https://deshelf.invalid/container.html')).toBeUndefined();
		expect(resolveCacheUrl(CACHE_ROOT, 'not a url')).toBeUndefined();
	});

	test('session-assets host is handled by the asset store, not the filesystem', () => {
		expect(resolveCacheUrl(CACHE_ROOT, 'deshelf-cache://session-assets/some-handle')).toBeUndefined();
	});

	test('cacheUrlFor produces canonical URLs', () => {
		expect(cacheUrlFor('builds\\loc-a\\abc\\container.html')).toBe('deshelf-cache://builds/loc-a/abc/container.html');
	});
});
