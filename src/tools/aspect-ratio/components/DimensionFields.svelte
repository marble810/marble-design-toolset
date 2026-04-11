<script lang="ts">
	interface Props {
		widthPx: number;
		heightPx: number;
		widthError: string;
		heightError: string;
		onWidthChange?: (event: Event) => void;
		onHeightChange?: (event: Event) => void;
	}

	let { widthPx, heightPx, widthError, heightError, onWidthChange, onHeightChange }: Props = $props();
</script>

<div class="dimension-fields">
	<div class="dimension-fields__group">
		<label class="dimension-fields__label" for="aspect-ratio-width">Width (px)</label>
		<input
			id="aspect-ratio-width"
			type="number"
			min="1"
			value={widthPx}
			onchange={onWidthChange}
			class="pixel-input"
		/>
		{#if widthError}
			<p class="dimension-fields__error">{widthError}</p>
		{/if}
	</div>

	<div class="dimension-fields__group">
		<label class="dimension-fields__label" for="aspect-ratio-height">Height (px)</label>
		<input
			id="aspect-ratio-height"
			type="number"
			min="1"
			value={heightPx}
			onchange={onHeightChange}
			class="pixel-input"
		/>
		{#if heightError}
			<p class="dimension-fields__error">{heightError}</p>
		{/if}
	</div>
</div>

<style>
	.dimension-fields {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.dimension-fields__group {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.dimension-fields__label {
		color: var(--color-fg-secondary);
		font-size: var(--font-size-1);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.dimension-fields__error {
		margin: 0;
		color: var(--color-danger);
		font-size: var(--font-size-1);
	}
</style>