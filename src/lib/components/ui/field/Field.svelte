<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		forId?: string;
		hint?: string;
		error?: string;
		children?: Snippet;
	}

	let { label, forId, hint = '', error = '', children }: Props = $props();
</script>

<div class="field">
	{#if forId}
		<label class="field__label" for={forId}>{label}</label>
	{:else}
		<span class="field__label">{label}</span>
	{/if}

	{@render children?.()}

	{#if error}
		<p class="field__error">{error}</p>
	{:else if hint}
		<p class="field__hint">{hint}</p>
	{/if}
</div>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.field__label {
		color: var(--color-fg-secondary);
		font-size: var(--font-size-1);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.field__hint,
	.field__error {
		margin: 0;
		font-size: var(--font-size-1);
		line-height: var(--line-height-base);
	}

	.field__hint {
		color: var(--color-fg-muted);
	}

	.field__error {
		color: var(--color-danger);
	}
</style>