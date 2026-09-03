/**
 * Deshelf Desktop Host chrome (Host UI renderer, plain DOM + CSS custom properties).
 *
 * Wires the Open Project → Forge build → Tool list → Tool Session flow over the typed
 * bridge, hosts the canvas/slate WebContents views, and mounts the Standard Inspector
 * (Host-owned, never inside the Tool Container).
 */
import type { CatalogEntry } from 'tool-contract';
import { DesktopToolController, type DesktopHostBridge, type DesktopToolControllerOptions } from '../host/desktop-tool-controller.ts';
import type { CatalogListResult, ProjectLocationInfo, BuildProjectResult } from '../shared/bridge-protocol.ts';
import { renderInspector, type InspectorDomHandle } from './inspector-dom.ts';

declare global {
	interface Window {
		DeshelfHost: DesktopHostBridge & {
			openProject(): Promise<{ location: ProjectLocationInfo | null }>;
			buildProject(request: { projectLocationId: string }): Promise<BuildProjectResult>;
			listCatalog(): Promise<CatalogListResult>;
		};
	}
}

const bridge = window.DeshelfHost;
const elements = {
	openProject: document.querySelector<HTMLButtonElement>('#open-project') as HTMLButtonElement,
	build: document.querySelector<HTMLButtonElement>('#build-project') as HTMLButtonElement,
	restart: document.querySelector<HTMLButtonElement>('#restart-tool') as HTMLButtonElement,
	resetDefaults: document.querySelector<HTMLButtonElement>('#reset-defaults') as HTMLButtonElement,
	close: document.querySelector<HTMLButtonElement>('#close-tool') as HTMLButtonElement,
	toolList: document.querySelector<HTMLDivElement>('#tool-list') as HTMLDivElement,
	status: document.querySelector<HTMLDivElement>('#status') as HTMLDivElement,
	canvasHost: document.querySelector<HTMLDivElement>('#canvas-host') as HTMLDivElement,
	slateHost: document.querySelector<HTMLDivElement>('#slate-host') as HTMLDivElement,
	inspectorHost: document.querySelector<HTMLDivElement>('#inspector-host') as HTMLDivElement,
	assetBar: document.querySelector<HTMLDivElement>('#asset-bar') as HTMLDivElement,
	exportBar: document.querySelector<HTMLDivElement>('#export-bar') as HTMLDivElement
};

let locations: ProjectLocationInfo[] = [];
let catalog: CatalogListResult = { tools: [], locations: {}, entries: [] };
let controller: DesktopToolController | undefined;
let inspector: InspectorDomHandle | undefined;
let activeEntryId: string | undefined;

function setStatus(message: string, isError = false): void {
	elements.status.textContent = message;
	elements.status.classList.toggle('is-error', isError);
}

function requireEntry(catalogEntryId: string): CatalogEntry {
	const entry = catalog.entries.find((candidate) => candidate.catalogEntryId === catalogEntryId);
	if (entry === undefined) throw new Error(`catalog entry '${catalogEntryId}' not loaded`);
	return entry;
}

function renderToolList(): void {
	elements.toolList.textContent = '';
	for (const tool of catalog.tools) {
		const location = catalog.locations[tool.catalogEntryId];
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'tool-list__item';
		if (tool.catalogEntryId === activeEntryId) button.classList.add('is-active');
		const name = document.createElement('span');
		name.textContent = tool.name;
		const meta = document.createElement('span');
		meta.className = 'tool-list__meta';
		meta.textContent = location !== undefined ? `${location.slug} · ${location.projectDir}` : tool.slug;
		button.appendChild(name);
		button.appendChild(meta);
		button.addEventListener('click', () => void openTool(tool.catalogEntryId));
		elements.toolList.appendChild(button);
	}
}

function renderAssetAndExportBars(entry: CatalogEntry): void {
	elements.assetBar.textContent = '';
	for (const assetId of Object.keys(entry.assets)) {
		const slot = entry.assets[assetId] as { label: string };
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'bar__action';
		button.textContent = `Asset: ${slot.label}`;
		button.addEventListener('click', () => {
			void controller?.setAssetFromPicker(assetId).then((result) => {
				if (!result.ok) setStatus(`asset '${assetId}' not selected`);
			});
		});
		elements.assetBar.appendChild(button);
	}
	elements.exportBar.textContent = '';
	for (const outputId of Object.keys(entry.outputs)) {
		const output = entry.outputs[outputId] as { label: string };
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'bar__action';
		button.textContent = `Export: ${output.label}`;
		button.disabled = controller?.session.getState() !== 'Ready';
		button.addEventListener('click', () => void exportOutput(outputId));
		elements.exportBar.appendChild(button);
	}
}

function mountInspector(entry: CatalogEntry): void {
	inspector?.dispose();
	elements.inspectorHost.textContent = '';
	inspector = renderInspector(controller?.session.inspector as never, entry);
	elements.inspectorHost.appendChild(inspector.root);
}

async function openTool(catalogEntryId: string): Promise<void> {
	if (controller !== undefined) await controller.close();
	const entry = requireEntry(catalogEntryId);
	activeEntryId = catalogEntryId;
	const options: DesktopToolControllerOptions = {
		entry,
		bridge,
		canvasHost: elements.canvasHost,
		slateHost: entry.surfaces.slate ? elements.slateHost : undefined,
		onStateChange: (state) => {
			setStatus(`session: ${state}`);
			elements.restart.disabled = state !== 'Ready' && state !== 'Failed';
			elements.close.disabled = state === 'Closed';
			for (const button of elements.exportBar.querySelectorAll('button')) button.disabled = state !== 'Ready';
		},
		onDiagnostic: (diagnostic) => {
			if (diagnostic.severity === 'error') setStatus(`${diagnostic.code}: ${diagnostic.message}`, true);
		}
	};
	controller = new DesktopToolController(options);
	await controller.open();
	mountInspector(entry);
	renderAssetAndExportBars(entry);
	renderToolList();
}

async function exportOutput(outputId: string): Promise<void> {
	if (controller === undefined) return;
	const result = await controller.exportOutput(outputId);
	setStatus(result.ok ? `export '${outputId}' saved` : `export failed: ${result.error?.message ?? 'unknown error'}`, !result.ok);
}

async function refreshCatalog(): Promise<void> {
	catalog = await bridge.listCatalog();
	renderToolList();
}

elements.openProject.addEventListener('click', () => {
	void (async () => {
		const { location } = await bridge.openProject();
		if (location === null) {
			setStatus('open project canceled');
			return;
		}
		locations = [...locations.filter((existing) => existing.projectLocationId !== location.projectLocationId), location];
		setStatus(`opened '${location.name}' — build to register tools`);
		elements.build.disabled = false;
	})();
});

elements.build.addEventListener('click', () => {
	void (async () => {
		const latest = locations.at(-1);
		if (latest === undefined) return;
		setStatus(`building '${latest.slug}'…`);
		elements.build.disabled = true;
		const result = await bridge.buildProject({ projectLocationId: latest.projectLocationId });
		elements.build.disabled = false;
		if (!result.ok) {
			setStatus(result.diagnostics.map((d) => `${d.code}: ${d.message}`).join('\n') || 'build failed', true);
			return;
		}
		setStatus(result.fromCache ? `build served from cache (${result.tools.length} tool)` : `build published (${result.tools.length} tool)`);
		await refreshCatalog();
	})();
});

elements.restart.addEventListener('click', () => {
	void controller?.restart();
});

elements.resetDefaults.addEventListener('click', () => {
	controller?.session.resetDefaults();
});

elements.close.addEventListener('click', () => {
	void (async () => {
		if (controller === undefined) return;
		await controller.close();
		controller = undefined;
		inspector?.dispose();
		inspector = undefined;
		elements.inspectorHost.textContent = '';
		elements.canvasHost.textContent = '';
		elements.slateHost.textContent = '';
		elements.assetBar.textContent = '';
		elements.exportBar.textContent = '';
		setStatus('session closed');
	})();
});

void refreshCatalog();
