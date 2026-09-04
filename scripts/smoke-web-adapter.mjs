/**
 * Browser smoke test for the Deshelf Web adapter (manual/CI-optional): serves the
 * production build, opens the root Tool Host, opens the hello-canvas Catalog entry and
 * asserts the Tool Container reaches Ready + animates (rAF) + survives a Restart, then
 * opens the shallow-water entry and asserts the migrated simulation tool also reaches
 * Ready with a mounted canvas.
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
		if (!existsSync(file) || urlPath === '/') file = path.join(BUILD, 'index.html');
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

/** PNG IHDR width/height live at byte offsets 16..23. */
async function pngSize(file) {
	const handle = await fs.open(file, 'r');
	try {
		const header = Buffer.alloc(24);
		await handle.read(header, 0, 24, 0);
		return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
	} finally {
		await handle.close();
	}
}

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

	await page.goto(`${base}/`, { waitUntil: 'networkidle2', timeout: 30_000 });

	/** Opens the Catalog entry whose name matches, then waits for the Ready state. */
	async function openEntry(name) {
		await page.waitForSelector('.forge-page__entry', { timeout: 20_000 });
		const clicked = await page.evaluate((entryName) => {
			const entries = [...document.querySelectorAll('.forge-page__entry')];
			const target = entries.find((entry) => entry.querySelector('strong')?.textContent?.includes(entryName));
			if (target === undefined) return false;
			target.click();
			return true;
		}, name);
		if (!clicked) throw new Error(`catalog entry '${name}' not found`);
		await page.waitForFunction(
			() => document.querySelector('.forge-host__status')?.textContent.includes('Ready') === true,
			{ timeout: 30_000 }
		);
		console.log(`SMOKE: ${name} session Ready ✔`);
	}

	// --- hello-canvas: rAF animation, Parameter flow into the Slate, Restart ---------
	await openEntry('Hello Canvas');

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
	await page.click('[data-action="restart"]');
	await page.waitForFunction(
		() => document.querySelector('.forge-host__status')?.textContent.includes('Ready') === true,
		{ timeout: 30_000 }
	);
	console.log('SMOKE: restart → Ready ✔');

	// --- shallow-water: the migrated simulation Tool Project -------------------------
	await page.evaluate(() => {
		const back = document.querySelector('.forge-page__back');
		if (back === null) throw new Error('back-to-catalog button not found');
		back.click();
	});
	await openEntry('Shallow Water Height');

	const simCanvasCount = await page.evaluate(() => {
		const iframe = document.querySelector('iframe[data-deshelf-endpoint="main"]');
		return iframe !== null && iframe.contentDocument !== null ? iframe.contentDocument.querySelectorAll('canvas').length : 0;
	});
	if (simCanvasCount < 1) throw new Error(`expected a shallow-water <canvas>, got ${simCanvasCount}`);
	console.log('SMOKE: shallow-water canvas mounted ✔');

	// The migrated preset init map seeds the sim, then the rAF loop advances it: the
	// Inspector's Resimulate button (private callback) must stay wired after migration.
	const simStatus = await page.evaluate(() => {
		const iframe = document.querySelector('iframe[data-deshelf-endpoint="main"]');
		return iframe?.contentDocument?.querySelector('.shallow-canvas__overlay')?.textContent ?? 'no-overlay';
	});
	console.log(`SMOKE: shallow-water overlay status: '${simStatus}' (no error overlay expected)`);
	if (simStatus.includes('Failed to read init map')) throw new Error(`shallow-water init map failed: ${simStatus}`);

	await page.evaluate(() => {
		const buttons = [...document.querySelectorAll('.forge-inspector__button')];
		const resimulate = buttons.find((button) => button.textContent?.includes('Resimulate'));
		if (resimulate === undefined) throw new Error('Resimulate button not found in Inspector');
		resimulate.click();
	});
	await new Promise((resolve) => setTimeout(resolve, 500));
	console.log('SMOKE: shallow-water Resimulate (private callback) ✔');

	// Staged Reload over the same Catalog entry: the old Session stays active until the
	// replacement Canvas is Ready, then the commit swaps the containers.
	await page.click('[data-action="reload"]');
	await new Promise((resolve) => setTimeout(resolve, 1000));
	await page.waitForFunction(
		() => document.querySelector('.forge-host__status')?.textContent.includes('Ready') === true,
		{ timeout: 30_000 }
	);
	const reloadNotes = await page.evaluate(() => [...document.querySelectorAll('.forge-host__note')].map((n) => n.textContent));
	if (reloadNotes.some((note) => note.includes('reload rejected') || note.includes('failed'))) {
		throw new Error(`reload did not settle cleanly: ${JSON.stringify(reloadNotes)}`);
	}
	console.log('SMOKE: staged reload → Ready ✔');

	// --- Visual Outputs: deterministic PNG + recorded video exports -------------------
	const downloads = path.join(REPO, 'temp', 'smoke-downloads');
	await fs.rm(downloads, { recursive: true, force: true });
	await fs.mkdir(downloads, { recursive: true });
	const cdp = await page.createCDPSession();
	await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });

	// Still export = deterministic simulation frame 0 at the current resolution.
	await page.evaluate(() => {
		const button = [...document.querySelectorAll('.forge-host__action')].find((b) => b.textContent?.includes('Height Map PNG'));
		if (button === undefined) throw new Error('Height Map PNG export button not found');
		button.click();
	});
	await new Promise((resolve) => setTimeout(resolve, 2500));
	const stillFile = path.join(downloads, 'shallow-water-heightMap.png');
	if (!existsSync(stillFile)) throw new Error('heightMap PNG export did not download');
	const size = await pngSize(stillFile);
	if (size.width !== 256 || size.height !== 256) {
		throw new Error(`heightMap PNG should be the 256x256 simulation frame, got ${size.width}x${size.height}`);
	}
	console.log('SMOKE: heightMap PNG export (256x256 deterministic frame) ✔');

	// Video export = 90-frame deterministic replay recorded in the container (~4s).
	await page.evaluate(() => {
		const button = [...document.querySelectorAll('.forge-host__action')].find((b) => b.textContent?.includes('Simulation Video'));
		if (button === undefined) throw new Error('Simulation Video export button not found');
		button.click();
	});
	await new Promise((resolve) => setTimeout(resolve, 9000));
	const videoFiles = (await fs.readdir(downloads)).filter((name) => name.startsWith('shallow-water-simulationVideo'));
	if (videoFiles.length === 0) throw new Error('simulationVideo export did not download');
	const videoStat = await fs.stat(path.join(downloads, videoFiles[0]));
	if (videoStat.size < 10_000) throw new Error(`simulationVideo export looks empty (${videoStat.size} bytes)`);
	console.log(`SMOKE: simulationVideo export (${videoFiles[0]}, ${videoStat.size} bytes) ✔`);

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
