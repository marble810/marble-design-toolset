/**
 * Browser smoke test for the Deshelf Web adapter (manual/CI-optional): serves the
 * production build, opens /forge with headless Chrome, opens the first Catalog entry
 * and asserts the Tool Container reaches Ready + animates (rAF) + survives a Restart.
 *
 * Run: bun ./scripts/smoke-web-adapter.mjs   (requires `bun run build` first)
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const CANDIDATE_BROWSERS = [
	'C:/Program Files/Google/Chrome/Application/chrome.exe',
	'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
	'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
];
const { existsSync } = await import('node:fs');
const executablePath = CANDIDATE_BROWSERS.find((candidate) => existsSync(candidate));
if (executablePath === undefined) {
	console.error('no Chrome/Edge found for smoke test');
	process.exit(1);
}

// Minimal static file server for build/ (no framework, no deps).
const { createServer } = await import('node:http');
const { promises: fs } = await import('node:fs');
const BUILD = path.join(REPO, 'build');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' };
const server = createServer(async (req, res) => {
	try {
		let urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
		if (urlPath.endsWith('/')) urlPath += 'index.html';
		let file = path.join(BUILD, urlPath);
		if (!existsSync(file) || urlPath === '/forge') file = path.join(BUILD, 'forge.html');
		const body = await fs.readFile(file);
		res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
		res.end(body);
	} catch {
		res.writeHead(404);
		res.end('not found');
	}
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;
console.log(`serving ${BUILD} at ${base}`);

const browser = await puppeteer.launch({
	executablePath,
	headless: true,
	args: ['--no-sandbox', '--disable-dev-shm-usage']
});

/** Reads the hue label mirrored inside the Slate container (cross-frame, same-origin). */
async function readSlateHue(page) {
	return page.evaluate(() => {
		const iframe = document.querySelector('iframe[data-deshelf-endpoint="slate"]');
		if (iframe === null) return 'no-slate-iframe';
		const label = iframe.contentDocument?.querySelector('.slate span:first-of-type');
		return label?.textContent ?? 'no-label';
	});
}

try {
	const page = await browser.newPage();
	const consoleErrors = [];
	page.on('console', (message) => {
		if (message.type() === 'error') consoleErrors.push(message.text());
	});
	page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));

	await page.goto(`${base}/forge`, { waitUntil: 'networkidle2', timeout: 30_000 });

	// Open the first catalog entry.
	await page.waitForSelector('.forge-page__entry', { timeout: 20_000 });
	await page.click('.forge-page__entry');

	// Wait for the Session to become Ready (Host chrome status text).
	await page.waitForFunction(
		() => document.querySelector('.forge-host__status')?.textContent.includes('Ready') === true,
		{ timeout: 30_000 }
	);
	console.log('SMOKE: session Ready ✔');

	// The canvas iframe exists and its container mounted the tool canvas.
	const canvasCount = await page.evaluate(() => {
		const iframe = document.querySelector('iframe[data-deshelf-endpoint="main"]');
		return iframe !== null && iframe.contentDocument !== null ? iframe.contentDocument.querySelectorAll('canvas').length : 0;
	});
	if (canvasCount < 1) throw new Error(`expected a mounted <canvas> in the main container, got ${canvasCount}`);
	console.log('SMOKE: canvas mounted in iframe ✔');

	// Observe the Tool-owned frame marker before and after a delay. This proves the rAF
	// loop advances inside the iframe instead of merely proving that a canvas was mounted.
	const readFrameMarker = () => page.evaluate(() => {
		const iframe = document.querySelector('iframe[data-deshelf-endpoint="main"]');
		return iframe?.contentDocument?.querySelector('span[hidden]')?.textContent ?? '';
	});
	const frameBefore = await readFrameMarker();
	await new Promise((resolve) => setTimeout(resolve, 500));
	const frameAfter = await readFrameMarker();
	if (!frameBefore.startsWith('rAF ') || !frameAfter.startsWith('rAF ') || frameAfter === frameBefore) {
		throw new Error(`canvas rAF marker did not advance (${frameBefore} → ${frameAfter})`);
	}
	console.log(`SMOKE: iframe rAF advanced ${frameBefore} → ${frameAfter} ✔`);

	// Parameter flow: move the Hue slider in the Host inspector → Store → both containers.
	const hueBefore = await readSlateHue(page);
	await page.evaluate(() => {
		const slider = document.querySelector('.forge-inspector__slider');
		if (slider === null) throw new Error('hue slider not found');
		slider.value = '42';
		slider.dispatchEvent(new Event('input', { bubbles: true }));
		slider.dispatchEvent(new Event('change', { bubbles: true }));
	});
	await new Promise((resolve) => setTimeout(resolve, 800));
	const hueAfter = await readSlateHue(page);
	console.log(`SMOKE: hue mirror ${hueBefore} → ${hueAfter} ✔`);
	if (!hueAfter.includes('42')) throw new Error(`slate mirror did not follow the parameter change (${hueBefore} → ${hueAfter})`);

	// Restart keeps the page alive and returns to Ready.
	await page.click('.forge-host__restart');
	await page.waitForFunction(
		() => document.querySelector('.forge-host__status')?.textContent.includes('Ready') === true,
		{ timeout: 30_000 }
	);
	console.log('SMOKE: restart → Ready ✔');

	// Filter benign errors (favicon etc.) — surface everything else.
	const relevant = consoleErrors.filter((text) => !text.includes('favicon'));
	if (relevant.length > 0) {
		console.error('SMOKE: console errors:', relevant);
		process.exit(1);
	}
	console.log('SMOKE: no console errors ✔');
	console.log('ALL SMOKE CHECKS PASSED');
} finally {
	await browser.close();
	server.close();
}
