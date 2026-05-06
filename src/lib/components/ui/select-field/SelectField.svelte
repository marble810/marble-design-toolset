<script lang="ts">
	import { Field } from '../field/index.js';

	export interface SelectFieldOption {
		value: string;
		label: string;
		disabled?: boolean;
	}

	interface Props {
		label: string;
		value: string;
		options: readonly SelectFieldOption[];
		onchange: (value: string) => void;
		hint?: string;
		error?: string;
		id?: string;
	}

	let { label, value, options, onchange, hint = '', error = '', id = undefined }: Props = $props();

	function handleChange(event: Event) {
		onchange((event.currentTarget as HTMLSelectElement).value);
	}
</script>

<Field {label} forId={id} {hint} {error}>
	<select class="pixel-input select-field" {id} {value} onchange={handleChange}>
		{#each options as option (option.value)}
			<option value={option.value} disabled={option.disabled}>{option.label}</option>
		{/each}
	</select>
</Field>

<style>
	.select-field {
		width: 100%;
	}
</style>