<script lang="ts">
	interface Props {
		label: string;
		checked: boolean;
		onchange: (checked: boolean) => void;
		hint?: string;
		disabled?: boolean;
	}

	let { label, checked, onchange, hint = '', disabled = false }: Props = $props();

	function handleChange(event: Event) {
		onchange((event.currentTarget as HTMLInputElement).checked);
	}
</script>

<label class="checkbox-field">
	<input type="checkbox" {checked} {disabled} onchange={handleChange} />
	<span class="checkbox-field__body">
		<span class="checkbox-field__label">{label}</span>
		{#if hint}
			<span class="checkbox-field__hint">{hint}</span>
		{/if}
	</span>
</label>

<style>
	.checkbox-field {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: start;
		gap: var(--space-2);
		color: var(--color-fg-secondary);
		font-size: var(--font-size-1);
	}

	.checkbox-field input {
		margin: 2px 0 0;
	}

	.checkbox-field__body {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.checkbox-field__label {
		color: var(--color-fg-primary);
	}

	.checkbox-field__hint {
		color: var(--color-fg-muted);
		line-height: var(--line-height-base);
	}
</style>