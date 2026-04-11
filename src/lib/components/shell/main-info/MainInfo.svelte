<script lang="ts">
	import { DropdownMenu } from '$lib/components/ui/dropdown-menu/index.js';
	import type { DropdownMenuItem } from '$lib/components/ui/dropdown-menu/index.js';
	import type { ToolMenuAction } from '$lib/types/tool';

	interface Props {
		title: string;
		description: string;
		menuActions?: ToolMenuAction[];
		onMenuAction?: (actionId: string) => void;
		onAbout?: () => void;
	}

	let { title, description, menuActions = [], onMenuAction, onAbout }: Props = $props();

	let items = $derived.by<DropdownMenuItem[]>(() => {
		const menuItems: DropdownMenuItem[] = menuActions.map((action) => ({
			id: action.id,
			label: action.label,
			disabled: action.disabled
		}));

		if (menuItems.length > 0) {
			menuItems.push({ id: 'divider', separator: true });
		}

		menuItems.push({ id: 'about', label: 'About' });
		return menuItems;
	});

	function handleSelect(itemId: string) {
		if (itemId === 'about') {
			onAbout?.();
			return;
		}

		onMenuAction?.(itemId);
	}
</script>

<section class="main-info pixel-frame">
	<div class="main-info__header">
		<div class="main-info__text">
			<h1 class="main-info__title">{title}</h1>
			<p class="main-info__description">{description}</p>
		</div>

		<DropdownMenu
			items={items}
			triggerLabel=""
			triggerIcon="more-horizontal"
			triggerVariant="ghost"
			triggerSize="icon"
			triggerAriaLabel="Tool actions"
			onSelect={handleSelect}
		/>
	</div>
</section>

<style>
	.main-info {
		display: flex;
		flex-direction: column;
		padding: var(--space-4);
		gap: var(--space-3);
		background: rgba(149, 128, 255, 0.08);
	}

	.main-info__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-4);
	}

	.main-info__text {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-width: 0;
	}

	.main-info__title {
		margin: 0;
		font-size: var(--font-size-4);
		line-height: var(--line-height-tight);
		letter-spacing: 0.01em;
	}

	.main-info__description {
		margin: 0;
		color: var(--color-fg-secondary);
		font-size: var(--font-size-2);
	}
</style>