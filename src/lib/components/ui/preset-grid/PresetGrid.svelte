<script lang="ts">
	import { Button } from '../button/index.js';

	export interface PresetGridItem {
		value: string;
		label: string;
		title?: string;
		disabled?: boolean;
	}

	interface Props {
		items: readonly PresetGridItem[];
		value: string | null;
		onselect: (value: string) => void;
		columns?: 2 | 3 | 4;
	}

	let { items, value, onselect, columns = 3 }: Props = $props();
</script>

<div class="preset-grid" style={`--preset-grid-columns:${columns};`}>
	{#each items as item (item.value)}
		<Button
			variant={value === item.value ? 'solid' : 'outline'}
			size="sm"
			class="preset-grid__button"
			title={item.title}
			disabled={item.disabled}
			onclick={() => onselect(item.value)}
		>
			{item.label}
		</Button>
	{/each}
</div>

<style>
	.preset-grid {
		display: grid;
		grid-template-columns: repeat(var(--preset-grid-columns), minmax(0, 1fr));
		gap: var(--space-2);
	}

	:global(.preset-grid__button) {
		width: 100%;
	}
</style>