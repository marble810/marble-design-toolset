<script lang="ts">
	/**
	 * Forge demo Tool Host chrome (Web adapter): hosts the same-origin Main Container
	 * iframe plus the optional Slate iframe, the Standard Inspector, the Environment
	 * Inventory controls (Asset Input / Visual Output) and the Failed/Restart diagnostics
	 * surface. The heavy runtime lives in src/lib/forge/web/web-tool-controller.ts.
	 *
	 * Same-origin note: the Tool Container shares the Host renderer process — a looping
	 * tool can freeze this page. Failure isolation is NOT promised; Restart is the
	 * recovery path (see docs/for-framework-developers/web-iframe-adapter.md).
	 */
	import { onMount } from 'svelte';
	import type { CatalogEntry, Diagnostic } from 'tool-contract';
	import { WebToolController, type WebToolExportResult } from '$lib/forge/web/web-tool-controller.js';
	import ForgeInspector from './ForgeInspector.svelte';

	/** Reload source resolved by the app: the staged replacement Entry + its artifact. */
	export interface ReloadSource {
		entry: CatalogEntry;
		mainArtifactUrl: string;
	}

	interface Props {
		entry: CatalogEntry;
		/** Absolute URL of the static catalog.json used to resolve artifact references. */
		catalogUrl: string;
		/** Resolves the staged reload replacement; omit to hide the Reload control. */
		resolveReload?: (current: CatalogEntry) => Promise<ReloadSource | { error: string }>;
	}

	let { entry, catalogUrl, resolveReload }: Props = $props();

	let canvasHost = $state<HTMLElement | undefined>(undefined);
	let slateHost = $state<HTMLElement | undefined>(undefined);
	let state = $state<'Cataloged' | 'HostReady' | 'Booting' | 'Ready' | 'Failed' | 'Closed'>('Cataloged');
	let health = $state<'Responsive' | 'Unresponsive'>('Responsive');
	let diagnostics = $state<Diagnostic[]>([]);
	let controller = $state<WebToolController | undefined>(undefined);
	// Restart replaces the ToolSession's InspectorHost, so the inspector view remounts
	// (keyed) whenever the Session ID changes.
	let sessionId = $state('');
	let exportMessage = $state('');
	let assetMessage = $state('');

	const stateLabel = $derived(
		state === 'Ready' && health === 'Unresponsive' ? 'Ready · Unresponsive' : state
	);
	// Restart is the recovery path for Failed/Unresponsive and a plain "reboot" affordance
	// on Ready; Reset Defaults lives next to it.
	const showRestart = $derived(state === 'Ready' || state === 'Failed' || health === 'Unresponsive');
	const showReload = $derived(state === 'Ready' && resolveReload !== undefined);

	function noteDiagnostic(diagnostic: Diagnostic): void {
		diagnostics = [...diagnostics.slice(-19), diagnostic];
	}

	let reloadMessage = $state('');
	let reloading = $state(false);

	/** Staged Reload: the old Session stays active until the replacement Canvas is Ready. */
	async function reload(): Promise<void> {
		// Capture before awaiting: the host may unmount mid-flight and clear the state
		// reference, but the captured controller instance stays valid to settle.
		const active = controller;
		if (active === undefined || reloading || resolveReload === undefined) return;
		reloading = true;
		reloadMessage = '';
		try {
			const source = await resolveReload(entry);
			if ('error' in source) {
				reloadMessage = source.error;
				return;
			}
			const result = active.reload({ entry: source.entry, mainArtifactUrl: source.mainArtifactUrl });
			if (result.ok) {
				reloadMessage = 'replacement staged — old session stays active until Ready';
			} else {
				reloadMessage = `reload rejected: ${result.diagnostic?.code ?? 'unknown'}`;
				if (result.diagnostic !== undefined) noteDiagnostic(result.diagnostic);
			}
		} catch (err) {
			reloadMessage = err instanceof Error ? err.message : String(err);
		} finally {
			reloading = false;
		}
	}

	function resolveContainerPageUrl(mainArtifactUrl: string): string {
		// Generated artifacts live at <release>/artifacts/<slug>/<file>; the matching
		// import map and bootstrap must come from that same immutable release.
		return new URL('../../container.html', mainArtifactUrl).toString();
	}

	onMount(() => {
		const mainArtifactUrl = new URL(entry.artifacts.main, catalogUrl).toString();
		controller = new WebToolController({
			entry,
			containerPageUrl: resolveContainerPageUrl(mainArtifactUrl),
			mainArtifactUrl,
			canvasHost: canvasHost as HTMLElement,
			slateHost: entry.surfaces.slate ? (slateHost as HTMLElement) : undefined,
			onStateChange: (next) => {
				state = next;
				sessionId = controller !== undefined ? controller.session.sessionId : '';
			},
			onHealthChange: (next) => (health = next),
			// Reload commit swaps the Session without a state transition — re-key the
			// Session-bound Inspector view here.
			onSessionIdChange: (next) => (sessionId = next),
			onDiagnostic: noteDiagnostic
		});
		controller.open();
		return () => {
			controller?.close();
			controller = undefined;
		};
	});

	function restart(): void {
		controller?.restart();
	}

	function resetDefaults(): void {
		controller?.session.resetDefaults();
	}

	let assetInput = $state<HTMLInputElement | undefined>(undefined);
	let pendingAssetId = $state('');

	function pickAsset(assetId: string): void {
		pendingAssetId = assetId;
		assetInput?.click();
	}

	function onAssetPicked(event: Event): void {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file !== undefined && controller !== undefined && pendingAssetId !== '') {
			const content = controller.setAssetFromFile(pendingAssetId, file);
			assetMessage = `${pendingAssetId} ← ${content.kind}`;
		}
		input.value = '';
	}

	async function exportOutput(outputId: string): Promise<void> {
		if (controller === undefined) return;
		const result: WebToolExportResult = await controller.exportOutput(outputId);
		if (result.ok && result.content?.kind === 'blob-url') {
			const anchor = document.createElement('a');
			anchor.href = result.content.url;
			const mimeSubtype = result.content.mime.split(';')[0].split('/')[1] ?? 'bin';
			anchor.download = `${entry.slug}-${outputId}.${mimeSubtype.split('+')[0]}`;
			anchor.click();
			exportMessage = `${outputId} exported`;
		} else if (result.ok) {
			exportMessage = `${outputId}: no content`;
		} else {
			exportMessage = `${outputId} failed: ${result.error?.code ?? 'unknown'}`;
			if (result.error !== undefined) noteDiagnostic(result.error);
		}
	}
</script>

<div class="forge-host">
	<header class="forge-host__header">
		<div class="forge-host__title">
			<strong>{entry.name}</strong>
			<span class="forge-host__meta">v{entry.version} · {entry.slug} · forge {entry.forgeProfile}</span>
		</div>
		<div class="forge-host__status" data-state={stateLabel}>
			<span>{stateLabel}</span>
			{#if showRestart}
				<button type="button" class="forge-host__restart" data-action="restart" onclick={restart}>Restart Tool</button>
			{/if}
			{#if showReload}
				<button type="button" class="forge-host__restart" data-action="reload" disabled={reloading} onclick={reload}>Reload</button>
			{/if}
			{#if state === 'Ready'}
				<button type="button" class="forge-host__restart" data-action="reset" onclick={resetDefaults}>Reset Defaults</button>
			{/if}
		</div>
	</header>

	<div class="forge-host__body">
		<div class="forge-host__canvases">
			<div class="forge-host__canvas-host" bind:this={canvasHost}></div>
			{#if entry.surfaces.slate}
				<div class="forge-host__slate-host" bind:this={slateHost}></div>
			{/if}
		</div>

		<aside class="forge-host__inspector">
			<div class="forge-host__panel-title">Inspector</div>
			{#if controller !== undefined}
				{#key sessionId}
					<ForgeInspector {entry} store={controller.session.store} inspector={controller.session.inspector} />
				{/key}
			{/if}
			{#if Object.keys(entry.assets).length > 0}
				<div class="forge-host__panel-title">Assets</div>
				{#each Object.values(entry.assets) as asset (asset.id)}
					<button type="button" class="forge-host__action" onclick={() => pickAsset(asset.id)}>
						Load {asset.label}
					</button>
				{/each}
				{#if assetMessage !== ''}
					<div class="forge-host__note">{assetMessage}</div>
				{/if}
			{/if}
			{#if Object.keys(entry.outputs).length > 0}
				<div class="forge-host__panel-title">Export</div>
				{#each Object.values(entry.outputs) as output (output.id)}
					<button type="button" class="forge-host__action" disabled={state !== 'Ready'} onclick={() => exportOutput(output.id)}>
						Export {output.label}
					</button>
				{/each}
				{#if exportMessage !== ''}
					<div class="forge-host__note">{exportMessage}</div>
				{/if}
			{/if}
			{#if reloadMessage !== ''}
				<div class="forge-host__note">{reloadMessage}</div>
			{/if}
		</aside>
	</div>

	{#if diagnostics.length > 0}
		<footer class="forge-host__diagnostics">
			{#each diagnostics as diagnostic, index (index)}
				<div class="forge-host__diagnostic" data-severity={diagnostic.severity}>
					{diagnostic.code}: {diagnostic.message}
				</div>
			{/each}
		</footer>
	{/if}

	<input bind:this={assetInput} type="file" hidden onchange={onAssetPicked} />
</div>

<style>
	.forge-host {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		height: 100%;
		min-height: 0;
	}
	.forge-host__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
	}
	.forge-host__title {
		display: flex;
		align-items: baseline;
		gap: var(--space-3);
	}
	.forge-host__meta {
		color: var(--color-fg-muted);
		font-size: var(--font-size-2);
	}
	.forge-host__status {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--color-border-soft);
		background: var(--color-bg-surface);
		font-size: var(--font-size-2);
	}
	.forge-host__status[data-state='Failed'],
	.forge-host__status[data-state='Ready · Unresponsive'] {
		border-color: var(--color-danger);
		color: var(--color-danger);
	}
	.forge-host__status[data-state='Ready'] {
		border-color: var(--color-border-soft);
		color: var(--color-success);
	}
	.forge-host__restart {
		height: 24px;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border-strong);
		background: var(--color-bg-elevated);
		color: var(--color-fg-primary);
		font-family: var(--font-family-base);
		font-size: var(--font-size-1);
		cursor: pointer;
	}
	.forge-host__restart:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.forge-host__restart:hover {
		border-color: var(--color-border-focus);
	}
	.forge-host__body {
		display: grid;
		grid-template-columns: 1fr 264px;
		gap: var(--space-3);
		flex: 1;
		min-height: 0;
	}
	.forge-host__canvases {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		min-height: 0;
	}
	.forge-host__canvas-host {
		flex: 1;
		min-height: 320px;
		border: 1px solid var(--color-border-strong);
		background: var(--color-bg-canvas);
	}
	.forge-host__slate-host {
		height: 132px;
		border: 1px solid var(--color-border-soft);
		background: var(--color-bg-canvas);
	}
	.forge-host__inspector {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-3);
		border: 1px solid var(--color-border-soft);
		background: var(--color-bg-left-panel);
		overflow-y: auto;
	}
	.forge-host__panel-title {
		font-size: var(--font-size-1);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-fg-muted);
	}
	.forge-host__action {
		height: 28px;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border-strong);
		background: var(--color-bg-elevated);
		color: var(--color-fg-primary);
		font-family: var(--font-family-base);
		font-size: var(--font-size-2);
		cursor: pointer;
		text-align: left;
	}
	.forge-host__action:hover:not(:disabled) {
		border-color: var(--color-border-focus);
	}
	.forge-host__action:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.forge-host__note {
		color: var(--color-fg-muted);
		font-size: var(--font-size-1);
	}
	.forge-host__diagnostics {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		max-height: 96px;
		overflow-y: auto;
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--color-border-soft);
		background: var(--color-bg-inset);
	}
	.forge-host__diagnostic {
		font-size: var(--font-size-1);
		color: var(--color-fg-secondary);
	}
	.forge-host__diagnostic[data-severity='error'] {
		color: var(--color-danger);
	}
</style>
