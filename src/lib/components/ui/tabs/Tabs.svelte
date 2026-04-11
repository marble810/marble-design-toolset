<script lang="ts">
	import { Tabs as BitsTabs } from 'bits-ui';
	import { PixelIcon } from '../pixel-icon/index.js';

	export interface TabItem {
		id: string;
		label: string;
		closable?: boolean;
	}

	interface Props {
		items: TabItem[];
		value?: string;
		onClose?: (itemId: string) => void;
	}

	let { items, value = $bindable(''), onClose }: Props = $props();

	function closeItem(event: MouseEvent, itemId: string) {
		event.preventDefault();
		event.stopPropagation();
		onClose?.(itemId);
	}
</script>

<BitsTabs.Root bind:value activationMode="manual" class="tabs-root">
	<BitsTabs.List class="tabs-list">
		{#each items as item (item.id)}
			<div class="tabs-item">
				<BitsTabs.Trigger value={item.id} class="tabs-trigger">
					<span class="tabs-trigger__label">{item.label}</span>
				</BitsTabs.Trigger>

				{#if item.closable}
					<button
						type="button"
						class="tabs-close"
						aria-label={`Close ${item.label}`}
						onmousedown={(event) => event.preventDefault()}
						onclick={(event) => closeItem(event, item.id)}
					>
						<PixelIcon name="cancel" size={12} />
					</button>
				{/if}
			</div>
		{/each}
	</BitsTabs.List>
</BitsTabs.Root>

<style>
	:global(.tabs-root) {
		display: flex;
		min-width: 0;
	}

	:global(.tabs-list) {
		display: flex;
		align-items: stretch;
		gap: var(--space-2);
		min-width: 0;
		overflow-x: auto;
	}

	.tabs-item {
		position: relative;
		display: flex;
		align-items: stretch;
		min-width: 0;
	}

	:global(.tabs-trigger) {
		display: inline-flex;
		align-items: center;
		min-width: 104px;
		max-width: 220px;
		height: 28px;
		padding: 0 34px 0 var(--space-4);
		border: var(--border-width-inner) solid var(--color-border-soft);
		background: var(--color-bg-panel);
		color: var(--color-fg-muted);
		font-size: var(--font-size-2);
		text-align: left;
		cursor: pointer;
		transition:
			background var(--duration-fast) var(--easing-standard),
			border-color var(--duration-fast) var(--easing-standard),
			color var(--duration-fast) var(--easing-standard);
	}

	:global(.tabs-trigger[data-state='active']) {
		background: #2f275a;
		border-color: #6d5ed2;
		color: var(--color-fg-primary);
	}

	:global(.tabs-trigger:hover) {
		color: var(--color-fg-primary);
		border-color: var(--color-border-strong);
	}

	.tabs-trigger__label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tabs-close {
		position: absolute;
		right: var(--space-2);
		top: 50%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		transform: translateY(-50%);
		color: var(--color-fg-muted);
		cursor: pointer;
		transition: color var(--duration-fast) var(--easing-standard);
	}

	.tabs-close:hover {
		color: var(--color-fg-primary);
	}
</style>