<script lang="ts">
	interface Props {
		label: string;
		min: number;
		max: number;
		step?: number;
		value: number;
		onchange: (value: number) => void;
		hardMin?: number;
		hardMax?: number;
	}

	let {
		label,
		min,
		max,
		step = 1,
		value,
		onchange,
		hardMin,
		hardMax
	}: Props = $props();

	let isEditing = $state(false);
	let editingValue = $state('');

	$effect(() => {
		if (!isEditing) {
			editingValue = String(value);
		}
	});

	const sliderValue = $derived.by(() => {
		const parsed = Number(editingValue);
		if (!Number.isFinite(parsed)) {
			return value;
		}
		if (parsed < min) return min;
		if (parsed > max) return max;
		return parsed;
	});

	function handleSliderInput(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		const parsed = Number(target.value);
		if (!Number.isFinite(parsed)) {
			return;
		}
		editingValue = String(parsed);
		onchange(parsed);
	}

	function handleNumberInput(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		editingValue = target.value;
		if (target.value === '' || target.value === '-') {
			return;
		}
		const parsed = Number(target.value);
		if (Number.isFinite(parsed)) {
			onchange(parsed);
		}
	}

	function handleNumberFocus() {
		isEditing = true;
	}

	function handleNumberBlur() {
		isEditing = false;
		const parsed = Number(editingValue);
		if (!Number.isFinite(parsed)) {
			editingValue = String(value);
			return;
		}
		let next = parsed;
		if (hardMin !== undefined && next < hardMin) next = hardMin;
		if (hardMax !== undefined && next > hardMax) next = hardMax;
		editingValue = String(next);
		if (next !== value) {
			onchange(next);
		}
	}
</script>

<div class="slider-field">
	<span class="slider-field__label">{label}</span>
	<div class="slider-field__row">
		<input
			class="slider-field__range"
			type="range"
			{min}
			{max}
			{step}
			value={sliderValue}
			oninput={handleSliderInput}
		/>
		<input
			class="slider-field__number pixel-input"
			type="number"
			{step}
			value={editingValue}
			oninput={handleNumberInput}
			onfocus={handleNumberFocus}
			onblur={handleNumberBlur}
		/>
	</div>
</div>

<style>
	.slider-field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.slider-field__label {
		color: var(--color-fg-secondary);
		font-size: var(--font-size-1);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.slider-field__row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.slider-field__range {
		flex: 1 1 auto;
		min-width: 0;
		height: 20px;
		margin: 0;
		padding: 0;
		background: transparent;
		appearance: none;
		-webkit-appearance: none;
		cursor: pointer;
	}

	.slider-field__range:focus {
		outline: none;
	}

	.slider-field__range::-webkit-slider-runnable-track {
		height: 6px;
		background: var(--color-bg-inset);
		border: var(--border-width-inner) solid var(--color-border-soft);
	}

	.slider-field__range:hover::-webkit-slider-runnable-track {
		border-color: var(--color-border-strong);
		background: var(--color-bg-input-active);
	}

	.slider-field__range:focus::-webkit-slider-runnable-track {
		border-color: var(--color-border-focus);
		background: var(--color-bg-input-active);
	}

	.slider-field__range::-webkit-slider-thumb {
		appearance: none;
		-webkit-appearance: none;
		width: 12px;
		height: 16px;
		margin-top: -6px;
		background: var(--color-accent);
		border: var(--border-width-outer) solid var(--color-border-strong);
		cursor: pointer;
	}

	.slider-field__range:hover::-webkit-slider-thumb {
		background: var(--color-accent-soft);
	}

	.slider-field__range:focus::-webkit-slider-thumb {
		border-color: var(--color-border-focus);
	}

	.slider-field__range::-moz-range-track {
		height: 6px;
		background: var(--color-bg-inset);
		border: var(--border-width-inner) solid var(--color-border-soft);
	}

	.slider-field__range:hover::-moz-range-track {
		border-color: var(--color-border-strong);
		background: var(--color-bg-input-active);
	}

	.slider-field__range:focus::-moz-range-track {
		border-color: var(--color-border-focus);
		background: var(--color-bg-input-active);
	}

	.slider-field__range::-moz-range-thumb {
		width: 12px;
		height: 16px;
		background: var(--color-accent);
		border: var(--border-width-outer) solid var(--color-border-strong);
		border-radius: 0;
		cursor: pointer;
	}

	.slider-field__range:hover::-moz-range-thumb {
		background: var(--color-accent-soft);
	}

	.slider-field__range:focus::-moz-range-thumb {
		border-color: var(--color-border-focus);
	}

	.slider-field__number {
		flex: 0 0 64px;
		width: 64px;
		padding: 0 var(--space-2);
		font-size: var(--font-size-2);
		text-align: right;
	}

	.slider-field__number::-webkit-inner-spin-button,
	.slider-field__number::-webkit-outer-spin-button {
		appearance: none;
		-webkit-appearance: none;
		margin: 0;
	}

	.slider-field__number {
		appearance: textfield;
		-moz-appearance: textfield;
	}
</style>
