<script lang="ts">
	import { Field } from '../field/index.js';

	export interface SegmentedControlOption {
		value: string;
		label: string;
		disabled?: boolean;
	}

	interface Props {
		label: string;
		value: string;
		options: readonly SegmentedControlOption[];
		onchange: (value: string) => void;
		hint?: string;
	}

	let { label, value, options, onchange, hint = '' }: Props = $props();
</script>

<Field {label} {hint}>
	<div class="segmented-control" role="group" aria-label={label}>
		{#each options as option (option.value)}
			<button
				type="button"
				class="segmented-control__button"
				data-active={value === option.value}
				disabled={option.disabled}
				onclick={() => onchange(option.value)}
			>
				{option.label}
			</button>
		{/each}
	</div>
</Field>

<style>
	.segmented-control {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(0, 1fr);
		gap: var(--space-2);
	}

	.segmented-control__button {
		min-width: 0;
		height: 28px;
		padding: 0 var(--space-2);
		border: var(--border-width-inner) solid var(--color-border-soft);
		background: transparent;
		color: var(--color-fg-secondary);
		font-size: var(--font-size-1);
		cursor: pointer;
	}

	.segmented-control__button[data-active='true'] {
		border-color: #6d5ed2;
		background: #2f275a;
		color: #f4f0ff;
	}

	.segmented-control__button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
</style>