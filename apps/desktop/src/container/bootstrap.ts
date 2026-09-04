/**
 * Deshelf Desktop Tool Container bootstrap — runs INSIDE the sandboxed container
 * WebContents (bundled into `<buildDir>/container.html` by the Desktop Forge build).
 *
 * Responsibilities:
 * - receive the one-time MessagePort handoff from the Main process (via the container
 *   preload's fixed `DeshelfContainer.onPort` bridge — no Node, no ipcRenderer here);
 * - build the container-side MessagePort transport;
 * - wait for the single `boot` request (no hello/welcome/registration stage);
 * - dynamically import the pre-compiled Tool Entry artifact URL passed as `?entry=`
 *   (served from `deshelf-cache://` — real filesystem paths never reach this realm);
 * - mount the Canvas (main endpoint) or Tool Slate (slate endpoint) with the container
 *   surface context and emit `surface.ready`.
 *
 * rAF loops, GPU contexts and Canvas pixels live here and never cross the Environment
 * API. Unlike the Web same-origin iframe, this realm is a separate renderer process:
 * a looping tool wedges only this WebContents, and Restart destroys the realm in Main.
 */
import { startToolContainer, type ContainerSurfaceContext, type ToolContainerRuntimeHandle, type VisualToolDefinition } from 'tool-sdk';
import { createPortTransport, type PortLike } from '../transport/port-transport.ts';

/** Fixed bridge installed by the container preload — the realm's ONLY Main access. */
interface DeshelfContainerBridge {
	onPort(callback: (port: PortLike) => void): void;
}

declare global {
	interface Window {
		DeshelfContainer?: DeshelfContainerBridge;
	}
}

function showFatalError(message: string): void {
	if (document.getElementById('__deshelf-container-error') !== null) return;
	const box = document.createElement('pre');
	box.id = '__deshelf-container-error';
	box.setAttribute(
		'style',
		'margin:0;padding:12px;font:12px/1.5 monospace;color:#ffb4b4;background:#2a1215;white-space:pre-wrap;'
	);
	box.textContent = `Deshelf Tool Container failed:\n${message}`;
	document.body.appendChild(box);
}

/** Dynamic import of the runtime artifact URL — invisible to the bundler on purpose. */
async function importEntryArtifact(entryUrl: string): Promise<VisualToolDefinition> {
	const module = (await import(/* @vite-ignore */ entryUrl)) as { default?: unknown };
	const definition = module.default;
	if (definition === null || typeof definition !== 'object') {
		throw new Error('Tool Entry artifact must default-export a defineVisualTool definition');
	}
	return definition as VisualToolDefinition;
}

/** Minimal structural typing of the Forge-supplied Svelte runtime mount API. */
interface SvelteMountApi {
	mount(component: unknown, options: { target: Element; props?: Record<string, unknown> }): unknown;
	unmount(component: unknown): void;
}

async function mountSurfaceComponent(
	endpoint: 'main' | 'slate',
	context: ContainerSurfaceContext,
	definition: VisualToolDefinition
): Promise<() => void> {
	const loader = endpoint === 'slate' ? definition.slate : definition.canvas;
	if (typeof loader !== 'function') {
		throw new Error(endpoint === 'slate' ? 'Tool declares no Slate surface' : 'Tool Entry declares no canvas');
	}
	const loaded = (await loader()) as { default?: unknown } | unknown;
	const component = (loaded as { default?: unknown } | null)?.default ?? loaded;
	// `svelte` is a Forge-supplied Framework Library resolved through the container page
	// import map — never bundled into the bootstrap.
	const svelte = (await import('svelte')) as unknown as SvelteMountApi;
	const instance = svelte.mount(component, { target: document.body, props: { context } });
	return () => {
		try {
			svelte.unmount(instance);
		} catch {
			// component may already be destroyed
		}
	};
}

async function bootstrap(): Promise<void> {
	const params = new URLSearchParams(document.location.search);
	const entryUrl = params.get('entry');
	const endpoint = params.get('endpoint') === 'slate' ? 'slate' : 'main';
	if (entryUrl === null || entryUrl.length === 0) {
		showFatalError('missing ?entry=<artifact url> query parameter');
		return;
	}

	// The Main process transferred exactly one MessagePort into this realm.
	const port = await new Promise<PortLike>((resolve, reject) => {
		const bridge = window.DeshelfContainer;
		if (bridge === undefined) {
			reject(new Error('DeshelfContainer bridge is unavailable (container preload missing?)'));
			return;
		}
		bridge.onPort((received) => resolve(received));
	});

	let runtime: ToolContainerRuntimeHandle;
	try {
		runtime = startToolContainer({
			transport: createPortTransport(port),
			endpoint,
			loadDefinition: () => importEntryArtifact(entryUrl),
			mountSurface: (context, definition) => mountSurfaceComponent(endpoint, context, definition),
			onBootError: (diagnostic) => showFatalError(`${diagnostic.code}: ${diagnostic.message}`)
		});
	} catch (err) {
		showFatalError(err instanceof Error ? err.message : String(err));
		return;
	}

	try {
		await runtime.ready;
	} catch {
		// onBootError already displayed the diagnostic; keep the container dormant. The
		// Host startup timeout drives the Session to Failed with Restart in Host chrome.
	}
}

void bootstrap();
