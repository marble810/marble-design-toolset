<script lang="ts">
	import { Collapsible as BitsCollapsible } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import { PixelIcon } from '../pixel-icon/index.js';

	interface Props {
		title: string;
		open?: boolean;
		children?: Snippet;
	}

	let { title, open = $bindable(false), children }: Props = $props();
</script>

<BitsCollapsible.Root bind:open class="collapsible">
	<BitsCollapsible.Trigger class="collapsible__trigger">
		<span>{title}</span>
		<PixelIcon name={open ? 'chevron-up' : 'chevron-down'} size={14} />
	</BitsCollapsible.Trigger>

	<BitsCollapsible.Content forceMount>
		{#snippet child({ props, open: isOpen })}
			{#if isOpen}
				<div {...props} class="collapsible__content">
					{@render children?.()}
				</div>
			{/if}
		{/snippet}
	</BitsCollapsible.Content>
</BitsCollapsible.Root>

<style>
	.collapsible {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.collapsible__trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 30px;
		padding: 0 var(--space-3);
		border: var(--border-width-inner) solid var(--color-border-soft);
		background: var(--color-bg-elevated);
		color: var(--color-fg-primary);
		font-size: var(--font-size-2);
		cursor: pointer;
	}

	.collapsible__content {
		padding: var(--space-3);
		border: var(--border-width-inner) solid var(--color-border-soft);
		background: rgba(255, 255, 255, 0.03);
	}
</style>