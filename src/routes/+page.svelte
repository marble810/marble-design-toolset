<script lang="ts">
	/**
	 * Deshelf Web — Catalog-driven Tool Host (root workspace).
	 *
	 * The root loads the build-time generated static Catalog (never the removed runtime
	 * registry), lists the usable Catalog Entries and opens a Tool inside the same-origin
	 * iframe Tool Container with the Host chrome: Standard Inspector, Asset Input,
	 * Visual Output export, Restart/Reload/Reset diagnostics.
	 *
	 * Run `bun ./scripts/build-web-catalog.ts` (or `bun dev`) so /deshelf/catalog.json
	 * exists. Markdown checkpoint records are not part of the application.
	 */
	import { onMount } from 'svelte';
	import type { CatalogEntry } from 'tool-contract';
	import { StaticCatalogSource } from '$lib/forge/web/static-catalog-source.js';
	import Button from '$lib/components/ui/button/Button.svelte';
	import ForgeToolHost, { type ReloadSource } from '$lib/forge/components/ForgeToolHost.svelte';

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

	/** Reload source: re-fetch the static Catalog and resolve the same Entry identity. */
	async function resolveReload(current: CatalogEntry): Promise<ReloadSource | { error: string }> {
		try {
			const next = new StaticCatalogSource(CATALOG_URL);
			await next.load();
			const fresh = next.get(current.catalogEntryId);
			if (fresh === undefined) {
				return { error: 'entry no longer exists in the Catalog' };
			}
			const urls = next.resolveArtifactUrls(fresh);
			return { entry: fresh, mainArtifactUrl: urls.main };
		} catch (err) {
			return { error: err instanceof Error ? err.message : String(err) };
		}
	}

	onMount(() => {
		void loadCatalog();
	});
</script>

<div class="forge-page">
	<header class="forge-page__header">
		<strong>Deshelf Web · Tool Host</strong>
		<span class="forge-page__hint">same-origin iframe container · Catalog-driven</span>
		<Button class="forge-page__reload" variant="outline" size="sm" onclick={loadCatalog}>Reload Catalog</Button>
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
				<Button class="forge-page__entry" variant="outline" onclick={() => (activeEntry = entry)}>
					<strong>{entry.name}</strong>
					<span>{entry.slug} · v{entry.version} · {entry.libraries.length} lib(s) · slate: {entry.surfaces.slate ? 'yes' : 'no'}</span>
				</Button>
			{/each}
		</div>
	{:else}
		<div class="forge-page__tool">
			<Button class="forge-page__back" variant="ghost" size="sm" onclick={() => (activeEntry = undefined)}>← Catalog</Button>
			{#key catalogKey}
				<ForgeToolHost
					entry={activeEntry}
					catalogUrl={new URL(CATALOG_URL, location.href).toString()}
					resolveReload={resolveReload}
				/>
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
	:global(.forge-page__reload) {
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
	:global(.forge-page__entry) {
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
	:global(.forge-page__entry:hover) {
		border-color: var(--color-border-focus);
	}
	:global(.forge-page__entry span) {
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
	:global(.forge-page__back) {
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
