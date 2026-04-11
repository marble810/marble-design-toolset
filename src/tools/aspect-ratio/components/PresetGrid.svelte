<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';

	interface PresetRatio {
		label: string;
		w: number;
		h: number;
	}

	interface Props {
		presets: PresetRatio[];
		activeLabel: string | null;
		onSelect?: (preset: PresetRatio) => void;
	}

	let { presets, activeLabel, onSelect }: Props = $props();
</script>

<div class="preset-grid">
	{#each presets as preset}
		<Button
			variant={activeLabel === preset.label ? 'solid' : 'outline'}
			size="sm"
			class="preset-grid__button"
			onclick={() => onSelect?.(preset)}
		>
			{preset.label}
		</Button>
	{/each}
</div>

<style>
	.preset-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-2);
	}

	:global(.preset-grid__button) {
		width: 100%;
	}
</style>