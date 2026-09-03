<script lang="ts">
	/**
	 * Deshelf Web adapter demo (dev/diagnostics surface): loads the generated static
	 * Catalog, opens a Tool in the same-origin iframe Tool Container and exposes the
	 * Host chrome (Standard Inspector, Asset Input, Export, Failed/Restart diagnostics).
	 *
	 * Run `bun ./scripts/build-web-catalog.ts` (or `bun dev`) so /deshelf/catalog.json
	 * exists. See docs/for-framework-developers/web-iframe-adapter.md.
	 */
	import { onMount } from 'svelte';
	import type { CatalogEntry } from 'tool-contract';
	import { StaticCatalogSource } from '$lib/forge/web/static-catalog-source.js';
	import ForgeToolHost from '$lib/forge/components/ForgeToolHost.svelte';

	const CATALOG_URL = '/deshelf/catalog.json';

	let source = $state<StaticCatalogSource | undefined>(undefined);
	let entries = $state<CatalogEntry[]>([]);
	let activeEntry = $state<CatalogEntry | undefined>(undefined);
	let loadError = $state('');
	let loading = $state(true);
	let catalogKey = $state(0);

	async function loadCatalog(): Promise<void> {
		loading = true;
		loadError = '';
		activeEntry = undefined;
		try {
			const next = new StaticCatalogSource(CATALOG_URL);
			await next.load();
			source = next;
			entries = next.list();
			catalogKey += 1;
		} catch (err) {
			loadError = err instanceof Error ? err.message : String(err);
			entries = [];
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		void loadCatalog();
	});
</script>

<div class="forge-page">
	<header class="forge-page__header">
		<strong>Deshelf Web · Tool Container Adapter</strong>
		<span class="forge-page__hint">same-origin iframe container · Environment API demo</span>
		<button type="button" class="forge-page__reload" onclick={loadCatalog}>Reload Catalog</button>
	</header>

	{#if loading}
		<div class="forge-page__empty">Loading static Catalog…</div>
	{:else if loadError !== ''}
		<div class="forge-page__empty forge-page__error">
			{loadError}
			<span>Generate it with <code>bun ./scripts/build-web-catalog.ts</code>.</span>
		</div>
	{:else if entries.length === 0}
		<div class="forge-page__empty">
			Static Catalog is empty — no Tool Projects qualified under <code>tools/</code>.
		</div>
	{:else if activeEntry === undefined}
		<div class="forge-page__list">
			{#each entries as entry (entry.catalogEntryId)}
				<button type="button" class="forge-page__entry" onclick={() => (activeEntry = entry)}>
					<strong>{entry.name}</strong>
					<span>{entry.slug} · v{entry.version} · {entry.libraries.length} lib(s) · slate: {entry.surfaces.slate ? 'yes' : 'no'}</span>
				</button>
			{/each}
		</div>
	{:else}
		<div class="forge-page__tool">
			<button type="button" class="forge-page__back" onclick={() => (activeEntry = undefined)}>← Catalog</button>
			{#key catalogKey}
				<ForgeToolHost entry={activeEntry} catalogUrl={new URL(CATALOG_URL, location.href).toString()} />
			{/key}
		</div>
	{/if}
</div>

<style>
	.forge-page {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		height: 100vh;
		padding: var(--space-4);
		box-sizing: border-box;
		background: var(--color-bg-app);
		color: var(--color-fg-primary);
	}
	.forge-page__header {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.forge-page__hint {
		color: var(--color-fg-muted);
		font-size: var(--font-size-2);
	}
	.forge-page__reload {
		margin-left: auto;
		height: 28px;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border-strong);
		background: var(--color-bg-elevated);
		color: var(--color-fg-primary);
		font-family: var(--font-family-base);
		font-size: var(--font-size-2);
		cursor: pointer;
	}
	.forge-page__empty {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		align-items: center;
		justify-content: center;
		border: 1px solid var(--color-border-soft);
		background: var(--color-bg-surface);
		color: var(--color-fg-muted);
		padding: var(--space-6);
	}
	.forge-page__error {
		color: var(--color-danger);
	}
	.forge-page__list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: var(--space-3);
	}
	.forge-page__entry {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		padding: var(--space-4);
		border: 1px solid var(--color-border-soft);
		background: var(--color-bg-surface);
		color: var(--color-fg-primary);
		font-family: var(--font-family-base);
		text-align: left;
		cursor: pointer;
	}
	.forge-page__entry:hover {
		border-color: var(--color-border-focus);
	}
	.forge-page__entry span {
		color: var(--color-fg-muted);
		font-size: var(--font-size-1);
	}
	.forge-page__tool {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		flex: 1;
		min-height: 0;
	}
	.forge-page__back {
		align-self: flex-start;
		height: 26px;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border-soft);
		background: var(--color-bg-surface);
		color: var(--color-fg-secondary);
		font-family: var(--font-family-base);
		font-size: var(--font-size-2);
		cursor: pointer;
	}
</style>
