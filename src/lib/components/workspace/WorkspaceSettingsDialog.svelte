<script lang="ts">
	import { Dialog } from '$lib/components/ui/index.js';
	import {
		MAX_LEFT_PANEL_WIDTH_VW,
		MIN_LEFT_PANEL_WIDTH_VW
	} from '$lib/runtime/workspace-state';

	interface Props {
		open: boolean;
		leftPanelWidthVw: number;
		onChangeLeftPanelWidth: (value: number) => void;
	}

	let { open = $bindable(false), leftPanelWidthVw, onChangeLeftPanelWidth }: Props = $props();

	function handleChange(event: Event): void {
		onChangeLeftPanelWidth(Number((event.currentTarget as HTMLInputElement).value));
	}
</script>

<Dialog
	bind:open
	title="Settings"
	description="Workspace-wide preferences stored in local persistence."
	width="sm"
>
	<div class="settings-panel">
		<div class="settings-panel__row">
			<div>
				<label class="settings-panel__label" for="left-panel-width-range">Left Panel Width</label>
				<p class="settings-panel__hint">Stored as a viewport width value.</p>
			</div>
			<span class="settings-panel__value">{leftPanelWidthVw}vw</span>
		</div>

		<input
			id="left-panel-width-range"
			type="range"
			min={MIN_LEFT_PANEL_WIDTH_VW}
			max={MAX_LEFT_PANEL_WIDTH_VW}
			step="1"
			value={leftPanelWidthVw}
			oninput={handleChange}
			class="settings-panel__range"
		/>

		<input
			type="number"
			min={MIN_LEFT_PANEL_WIDTH_VW}
			max={MAX_LEFT_PANEL_WIDTH_VW}
			value={leftPanelWidthVw}
			onchange={handleChange}
			class="pixel-input"
		/>
	</div>
</Dialog>

<style>
	.settings-panel {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.settings-panel p {
		margin: 0;
		color: var(--color-fg-secondary);
	}

	.settings-panel__row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
	}

	.settings-panel__label {
		color: var(--color-fg-secondary);
		font-size: var(--font-size-1);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.settings-panel__hint {
		margin-top: var(--space-1);
	}

	.settings-panel__value {
		color: var(--color-fg-primary);
		font-size: var(--font-size-3);
	}

	.settings-panel__range {
		width: 100%;
	}
</style>