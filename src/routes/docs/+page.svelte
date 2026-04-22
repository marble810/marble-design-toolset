<script lang="ts">
	import { PixelIcon } from '$lib/components/ui';

	let { data } = $props();
</script>

{#if data.hasDocs}
	<section class="docs-home">
		<div class="docs-home__hero pixel-frame">
			<div class="docs-home__hero-shell">
				<div class="docs-home__eyebrow">
					<PixelIcon name="section" size={14} />
					<span>Documentation Workspace</span>
				</div>
				<h1 class="docs-home__title">Choose a document from the sidebar.</h1>
				<p class="docs-home__copy">
					This browser reads the repository docs tree directly and renders each Markdown page as a static docs route.
				</p>

				{#if data.firstDoc}
					<div class="docs-home__actions">
						<a class="button button--solid button--md" href={data.firstDoc.href}>
							<PixelIcon name="arrow-right" size={14} />
							<span>Read {data.firstDoc.title}</span>
						</a>
					</div>
				{/if}
			</div>
		</div>

		<div class="docs-home__stats">
			<div class="docs-home__stat">
				<span class="docs-home__stat-label">Sections</span>
				<strong class="docs-home__stat-value">{data.docsTree.groups.length}</strong>
			</div>
			<div class="docs-home__stat">
				<span class="docs-home__stat-label">Documents</span>
				<strong class="docs-home__stat-value">{data.docCount}</strong>
			</div>
			<div class="docs-home__stat">
				<span class="docs-home__stat-label">Source</span>
				<strong class="docs-home__stat-value">docs/</strong>
			</div>
		</div>
	</section>
{:else}
	<section class="docs-empty">
		<div class="docs-empty__icon pixel-frame">
			<div class="docs-empty__icon-shell">
				<PixelIcon name="cancel" size={18} />
			</div>
		</div>
		<h1 class="docs-empty__title">No documents available.</h1>
		<p class="docs-empty__copy">
			Add Markdown files under the repository docs directory to populate this browser.
		</p>
	</section>
{/if}

<style>
	.docs-home,
	.docs-empty {
		display: grid;
		align-content: center;
		gap: var(--space-6);
		min-height: 100%;
	}

	.docs-home__hero,
	.docs-empty {
		max-width: 720px;
	}

	.docs-home__hero-shell {
		display: grid;
		gap: var(--space-4);
		padding: var(--space-5);
		background: var(--color-bg-surface);
	}

	.docs-home__eyebrow {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--color-fg-muted);
		font-size: var(--font-size-1);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		width: fit-content;
	}

	.docs-home__title,
	.docs-empty__title {
		margin: 0;
		font-size: clamp(24px, 3vw, 34px);
		line-height: 1.1;
		letter-spacing: -0.03em;
	}

	.docs-home__copy,
	.docs-empty__copy {
		margin: 0;
		max-width: 64ch;
		color: var(--color-fg-secondary);
		font-size: var(--font-size-3);
		line-height: 1.8;
	}

	.docs-home__actions {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.docs-home__stats {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 180px));
		gap: var(--space-4);
	}

	.docs-home__stat {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-4);
		border: 1px solid var(--color-border-soft);
		background: var(--color-bg-surface);
	}

	.docs-home__stat-label {
		color: var(--color-fg-muted);
		font-size: var(--font-size-1);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.docs-home__stat-value {
		font-size: var(--font-size-5);
		line-height: 1;
	}

	.docs-empty__icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
	}

	.docs-empty__icon-shell {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		border: 1px solid var(--color-border-soft);
		background: var(--color-bg-surface);
		color: var(--color-fg-secondary);
	}

	@media (max-width: 1200px) {
		.docs-home__stats {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>