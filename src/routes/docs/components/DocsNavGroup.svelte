<script lang="ts">
	import type { DocsTreeNode } from '$lib/docs/catalog';
	import DocsNavGroup from './DocsNavGroup.svelte';

	interface Props {
		node: DocsTreeNode;
		activePath: string;
		depth?: number;
	}

	let { node, activePath, depth = 0 }: Props = $props();
</script>

<section class="docs-nav-group" style={`--docs-nav-depth:${depth};`}>
	<div class="docs-nav-group__label">{node.label}</div>

	{#if node.docs.length > 0}
		<div class="docs-nav-group__docs">
			{#each node.docs as doc}
				<a class="docs-nav-group__link" href={doc.href} data-active={activePath === doc.href}>
					<span>{doc.title}</span>
				</a>
			{/each}
		</div>
	{/if}

	{#if node.groups.length > 0}
		<div class="docs-nav-group__children">
			{#each node.groups as child}
				<DocsNavGroup node={child} {activePath} depth={depth + 1} />
			{/each}
		</div>
	{/if}
</section>

<style>
	.docs-nav-group {
		display: grid;
		gap: var(--space-2);
	}

	.docs-nav-group__label {
		padding-left: calc(var(--docs-nav-depth) * 12px);
		color: var(--color-fg-muted);
		font-size: var(--font-size-1);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.docs-nav-group__docs,
	.docs-nav-group__children {
		display: grid;
		gap: var(--space-1);
	}

	.docs-nav-group__link {
		display: flex;
		align-items: center;
		min-height: 30px;
        line-height: 1.3em;
		padding: 0 var(--space-3);
		margin-left: calc(var(--docs-nav-depth) * 12px);
		/* border: 1px solid var(--color-border-soft); */
		/* background: var(--color-bg-surface); */
		color: var(--color-fg-secondary);
		transition:
			background var(--duration-fast) var(--easing-standard),
			border-color var(--duration-fast) var(--easing-standard),
			color var(--duration-fast) var(--easing-standard),
			transform var(--duration-fast) var(--easing-standard);
	}

	.docs-nav-group__link:hover {
		border-color: var(--color-border-strong);
		background: var(--color-bg-highlight);
		color: var(--color-fg-primary);
		transform: translateX(2px);
	}

	.docs-nav-group__link[data-active='true'] {
		border-color: var(--color-border-focus);
		background: oklch(from var(--color-accent) l c h / 16%);
		color: var(--color-fg-primary);
	}
</style>