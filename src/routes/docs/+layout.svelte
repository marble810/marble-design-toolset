<script lang="ts">
	import { page } from '$app/state';
	import { PixelIcon } from '$lib/components/ui';
	import DocsNavGroup from './components/DocsNavGroup.svelte';

	let { data, children } = $props();
</script>

<div class="docs-browser">
	<header class="docs-browser__header pixel-frame">
		<div class="docs-browser__header-shell">
			<div class="docs-browser__brand">
				<div class="docs-browser__brand-icon">
					<PixelIcon name="info-box" size={18} />
				</div>
				<div class="docs-browser__brand-copy">
					<!-- <span class="docs-browser__eyebrow">Repository Docs</span> -->
					<strong class="docs-browser__title">mdt. Documentation</strong>
				</div>
			</div>

			<div class="docs-browser__meta">
				<span class="docs-browser__count">{data.docCount} docs indexed</span>
				<a class="button button--ghost button--sm" href="/">
					<PixelIcon name="open" size={14} />
					<span>Workspace</span>
				</a>
			</div>
		</div>
	</header>

	<div class="docs-browser__body">
		<aside class="docs-browser__sidebar pixel-frame">
			<div class="docs-browser__sidebar-shell">
				<div class="docs-browser__sidebar-copy">
					<span class="docs-browser__sidebar-label">Navigation</span>
					<p class="docs-browser__sidebar-note">Built directly from the repository docs directory.</p>
				</div>

				<nav class="docs-browser__nav pixel-scrollbar" aria-label="Documentation Navigation">
					{#if data.docsTree.docs.length > 0}
						<div class="docs-browser__root-docs">
							{#each data.docsTree.docs as doc}
								<a class="docs-browser__root-link" href={doc.href} data-active={page.url.pathname === doc.href}>
									{doc.title}
								</a>
							{/each}
						</div>
					{/if}

					{#if data.docsTree.groups.length > 0}
						<div class="docs-browser__nav-groups">
							{#each data.docsTree.groups as node}
								<DocsNavGroup {node} activePath={page.url.pathname} />
							{/each}
						</div>
					{:else if !data.hasDocs}
						<p class="docs-browser__nav-empty">No Markdown documents were found.</p>
					{/if}
				</nav>
			</div>
		</aside>

		<main class="docs-browser__main pixel-frame">
			<div class="docs-browser__main-shell pixel-scrollbar">
				{@render children()}
			</div>
		</main>
	</div>
</div>

<style>
	.docs-browser {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		height: 100%;
		padding: var(--space-4);
		gap: var(--space-4);
		background: var(--color-bg-app);
	}

	.docs-browser__header,
	.docs-browser__sidebar,
	.docs-browser__main {
		min-width: 0;
		min-height: 0;
	}

	.docs-browser__header-shell,
	.docs-browser__sidebar-shell,
	.docs-browser__main-shell {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		background: var(--color-bg-surface);
	}

	.docs-browser__header-shell {
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-5);
		padding: var(--space-4) var(--space-5);
	}

	.docs-browser__brand {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		min-width: 0;
	}

	.docs-browser__brand-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border: 1px solid var(--color-border-soft);
		background: var(--color-bg-inset);
		color: var(--color-fg-secondary);
	}

	.docs-browser__brand-copy,
	.docs-browser__sidebar-copy {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
    
	.docs-browser__sidebar-label {
		color: var(--color-fg-muted);
		font-size: var(--font-size-1);
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.docs-browser__title {
		font-size: var(--font-size-4);
		line-height: var(--line-height-tight);
	}

	.docs-browser__meta {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.docs-browser__count {
		color: var(--color-fg-secondary);
		font-size: var(--font-size-1);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.docs-browser__body {
		display: grid;
		grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
		gap: var(--space-4);
		min-height: 0;
	}

	.docs-browser__sidebar-shell {
		gap: var(--space-4);
		padding: var(--space-4);
		background: var(--color-bg-left-panel);
	}

	.docs-browser__sidebar-note,
	.docs-browser__nav-empty {
		margin: 0;
		color: var(--color-fg-secondary);
	}

	.docs-browser__nav {
		display: grid;
		align-content: start;
		gap: var(--space-4);
		min-height: 0;
		overflow: auto;
		padding-right: var(--space-2);
	}

	.docs-browser__nav-groups,
	.docs-browser__root-docs {
		display: grid;
		gap: var(--space-3);
	}

	.docs-browser__root-link {
		display: flex;
		align-items: center;
		min-height: 30px;
		padding: 0 var(--space-3);
		/* border: 1px solid var(--color-border-soft); */
		/* background: var(--color-bg-surface); */
		color: var(--color-fg-secondary);
		transition:
			background var(--duration-fast) var(--easing-standard),
			border-color var(--duration-fast) var(--easing-standard),
			color var(--duration-fast) var(--easing-standard);
	}

	.docs-browser__root-link:hover,
	.docs-browser__root-link[data-active='true'] {
		/* border-color: var(--color-border-strong); */
		/* background: var(--color-bg-highlight); */
		color: var(--color-fg-primary);
	}

	.docs-browser__main-shell {
		overflow: auto;
		padding: clamp(18px, 2.2vw, 30px);
	}

	@media (max-width: 1080px) {
		.docs-browser__body {
			grid-template-columns: 280px minmax(0, 1fr);
		}
	}
</style>