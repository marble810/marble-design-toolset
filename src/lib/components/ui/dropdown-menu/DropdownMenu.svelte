<script lang="ts">
	import { DropdownMenu as BitsDropdownMenu } from 'bits-ui';
	import { Button } from '../button/index.js';
	import { PixelIcon } from '../pixel-icon/index.js';
	import type { PixelIconName } from '../pixel-icon/index.js';

	export interface DropdownMenuItem {
		id: string;
		label?: string;
		disabled?: boolean;
		separator?: boolean;
		tone?: 'default' | 'danger';
	}

	interface Props {
		items: DropdownMenuItem[];
		triggerLabel?: string;
		triggerIcon?: PixelIconName;
		triggerVariant?: 'solid' | 'outline' | 'ghost' | 'danger';
		triggerSize?: 'sm' | 'md' | 'icon';
		triggerAriaLabel?: string;
		align?: 'start' | 'center' | 'end';
		side?: 'top' | 'right' | 'bottom' | 'left';
		sideOffset?: number;
		onSelect?: (itemId: string) => void;
	}

	let {
		items,
		triggerLabel = 'Menu',
		triggerIcon,
		triggerVariant = 'ghost',
		triggerSize = 'sm',
		triggerAriaLabel,
		align = 'start',
		side = 'bottom',
		sideOffset = 8,
		onSelect
	}: Props = $props();

	function handleSelect(itemId: string) {
		onSelect?.(itemId);
	}
</script>

<BitsDropdownMenu.Root>
	<BitsDropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				variant={triggerVariant}
				size={triggerSize}
				aria-label={triggerAriaLabel ?? triggerLabel}
			>
				{#if triggerIcon}
					<PixelIcon name={triggerIcon} size={14} />
				{/if}
				{#if triggerLabel}
					<span>{triggerLabel}</span>
				{/if}
			</Button>
		{/snippet}
	</BitsDropdownMenu.Trigger>

	<BitsDropdownMenu.Portal>
		<BitsDropdownMenu.Content {align} {side} {sideOffset} forceMount>
			{#snippet child({ wrapperProps, props, open })}
				{#if open}
					<div {...wrapperProps}>
						<div {...props} class="dropdown-menu__content pixel-frame">
							{#each items as item}
								{#if item.separator}
									<BitsDropdownMenu.Separator class="dropdown-menu__separator" />
								{:else if item.label}
									<BitsDropdownMenu.Item
										textValue={item.label}
										disabled={item.disabled}
										class={`dropdown-menu__item${item.tone === 'danger' ? ' dropdown-menu__item--danger' : ''}`}
										onSelect={() => handleSelect(item.id)}
									>
										{item.label}
									</BitsDropdownMenu.Item>
								{/if}
							{/each}
						</div>
					</div>
				{/if}
			{/snippet}
		</BitsDropdownMenu.Content>
	</BitsDropdownMenu.Portal>
</BitsDropdownMenu.Root>

<style>
	.dropdown-menu__content {
		display: flex;
		flex-direction: column;
		min-width: 176px;
		padding: var(--space-2);
		background: var(--color-bg-surface);
		box-shadow: 0 18px 42px rgba(0, 0, 0, 0.42);
	}

	.dropdown-menu__separator {
		height: 1px;
		margin: var(--space-2) var(--space-1);
		background: rgba(255, 255, 255, 0.08);
	}

	.dropdown-menu__item {
		display: flex;
		align-items: center;
		height: 28px;
		padding: 0 var(--space-3);
		color: var(--color-fg-secondary);
		font-size: var(--font-size-2);
		cursor: pointer;
		transition:
			background var(--duration-fast) var(--easing-standard),
			color var(--duration-fast) var(--easing-standard);
	}

	.dropdown-menu__item:hover,
	.dropdown-menu__item[data-highlighted] {
		background: rgba(149, 128, 255, 0.16);
		color: var(--color-fg-primary);
		outline: none;
	}

	.dropdown-menu__item[data-disabled] {
		opacity: 0.45;
		cursor: default;
	}

	.dropdown-menu__item--danger {
		color: #ffd9de;
	}

	.dropdown-menu__item--danger:hover,
	.dropdown-menu__item--danger[data-highlighted] {
		background: rgba(255, 111, 125, 0.16);
		color: #fff1f3;
	}
</style>