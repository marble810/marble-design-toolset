<script lang="ts">
	import { Collapsible as BitsCollapsible } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import { PixelIcon } from '$lib/components/ui/pixel-icon/index.js';

	interface Props {
		title: string;
		collapsible?: boolean;
		open?: boolean;
		children?: Snippet;
	}

	let { title, collapsible = false, open = $bindable(true), children }: Props = $props();
</script>

{#if collapsible}
	<BitsCollapsible.Root bind:open class="section pixel-frame">
		<div class="section__header">
			<h2 class="section__title">{title}</h2>
			<BitsCollapsible.Trigger class="section__toggle" aria-label={`${open ? 'Collapse' : 'Expand'} ${title}`}>
				<PixelIcon name={open ? 'chevron-up' : 'chevron-down'} size={14} />
			</BitsCollapsible.Trigger>
		</div>

		<BitsCollapsible.Content forceMount>
			{#snippet child({ props, open: isOpen })}
				{#if isOpen}
					<div {...props} class="section__body">
						{@render children?.()}
					</div>
				{/if}
			{/snippet}
		</BitsCollapsible.Content>
	</BitsCollapsible.Root>
{:else}
	<section class="section pixel-frame">
		<div class="section__header">
			<h2 class="section__title">{title}</h2>
		</div>
		<div class="section__body">
			{@render children?.()}
		</div>
	</section>
{/if}

<style>
	.section {
		display: flex;
		flex-direction: column;
		background: var(--color-bg-panel);
	}

	.section__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		padding: var(--space-3);
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	.section__title {
		margin: 0;
		font-size: var(--font-size-2);
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-fg-secondary);
		margin-left: var(--space-2);
	}

	.section__toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		color: var(--color-fg-muted);
		cursor: pointer;
		transition:
			background var(--duration-fast) var(--easing-standard),
			color var(--duration-fast) var(--easing-standard);
	}

	.section__toggle:hover {
		background: rgba(149, 128, 255, 0.12);
		color: var(--color-fg-primary);
	}

	.section__body {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-4);
	}
</style>