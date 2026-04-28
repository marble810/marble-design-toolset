<script lang="ts">
	import { Section } from '$lib/components/shell/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { SliderField } from '$lib/components/ui/slider-field/index.js';
	import type { FileInputController } from '$lib/runtime/file-input/index.js';
	import type { ImportedImageFileItem } from '$lib/types/file-input';
	import {
		RESOLUTION_OPTIONS,
		type ShallowWaterParameters,
		type SimulationResolution
	} from '../simulation/shared.js';

	interface Props {
		fileInput: FileInputController;
		imageItem: ImportedImageFileItem | null;
		parameters: ShallowWaterParameters;
		onParameterChange: <Key extends keyof ShallowWaterParameters>(
			key: Key,
			value: ShallowWaterParameters[Key]
		) => void;
		onReset: () => void;
	}

	let { fileInput, imageItem, parameters, onParameterChange, onReset }: Props = $props();

	function formatBytes(size: number): string {
		if (size < 1024) return `${size} B`;
		if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
		return `${(size / (1024 * 1024)).toFixed(1)} MB`;
	}
</script>

<Section title="Init Map">
	<div class="shallow-controls__source">
		{#if imageItem}
			<div class="shallow-controls__source-info">
				<span class="shallow-controls__source-name">{imageItem.name}</span>
				<span class="shallow-controls__source-meta">
					{imageItem.width} x {imageItem.height} px · {formatBytes(imageItem.size)}
				</span>
			</div>
			<div class="shallow-controls__source-actions">
				<Button variant="ghost" size="sm" onclick={() => void fileInput.pick()}>Replace</Button>
				<Button variant="ghost" size="sm" onclick={() => fileInput.clear()}>Clear</Button>
			</div>
		{:else}
			<p class="shallow-controls__hint">
				Drop a black-and-white image onto the preview, or browse to choose an init map.
			</p>
			<Button variant="outline" size="sm" onclick={() => void fileInput.pick()} disabled={fileInput.busy}>
				{fileInput.busy ? 'Loading...' : 'Browse...'}
			</Button>
		{/if}

		{#if fileInput.lastError}
			<p class="shallow-controls__error">{fileInput.lastError.message}</p>
		{/if}
	</div>
</Section>

<Section title="Simulation">
	<div class="shallow-controls__grid">
		<label class="shallow-controls__field">
			<span class="shallow-controls__caption">Resolution</span>
			<select
				class="pixel-input shallow-controls__select"
				value={parameters.resolution}
				onchange={(event) =>
					onParameterChange(
						'resolution',
						Number((event.currentTarget as HTMLSelectElement).value) as SimulationResolution
					)}
			>
				{#each RESOLUTION_OPTIONS as resolution}
					<option value={resolution}>{resolution} x {resolution}</option>
				{/each}
			</select>
		</label>

		<SliderField
			label="Amplitude"
			min={0}
			max={2}
			step={0.01}
			value={parameters.amplitude}
			onchange={(value) => onParameterChange('amplitude', value)}
		/>
		<SliderField
			label="Wave Speed"
			min={0}
			max={0.35}
			step={0.005}
			value={parameters.waveSpeed}
			onchange={(value) => onParameterChange('waveSpeed', value)}
		/>
		<SliderField
			label="Damping"
			min={0.9}
			max={0.999}
			step={0.001}
			value={parameters.damping}
			onchange={(value) => onParameterChange('damping', value)}
		/>
		<SliderField
			label="Edge Absorb"
			min={0}
			max={96}
			step={1}
			value={parameters.edgeAbsorb}
			onchange={(value) => onParameterChange('edgeAbsorb', Math.round(value))}
		/>
		<SliderField
			label="Steps / Frame"
			min={1}
			max={8}
			step={1}
			value={parameters.stepsPerFrame}
			onchange={(value) => onParameterChange('stepsPerFrame', Math.round(value))}
		/>
	</div>
</Section>

<Section title="Display" collapsible>
	<div class="shallow-controls__grid">
		<SliderField
			label="Contrast"
			min={0.25}
			max={6}
			step={0.05}
			value={parameters.contrast}
			onchange={(value) => onParameterChange('contrast', value)}
		/>
		<label class="shallow-controls__check">
			<input
				type="checkbox"
				checked={parameters.invert}
				onchange={(event) =>
					onParameterChange('invert', (event.currentTarget as HTMLInputElement).checked)}
			/>
			<span>Invert Init Map</span>
		</label>
		<Button variant="outline" size="sm" onclick={onReset}>Reset Parameters</Button>
	</div>
</Section>

<Section title="Output" collapsible>
	<ul class="shallow-controls__list">
		<li>Preview frame: 512 x 512 px</li>
		<li>Boundary: absorbing edge, no reflection</li>
		<li>Export: PNG and MP4/WebM via framework</li>
	</ul>
</Section>

<style>
	.shallow-controls__source,
	.shallow-controls__grid {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.shallow-controls__source-info,
	.shallow-controls__field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.shallow-controls__source-name {
		overflow: hidden;
		color: var(--color-fg-primary);
		font-size: var(--font-size-2);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.shallow-controls__source-meta,
	.shallow-controls__hint,
	.shallow-controls__list {
		color: var(--color-fg-muted);
		font-size: var(--font-size-1);
		line-height: var(--line-height-base);
	}

	.shallow-controls__hint {
		margin: 0;
	}

	.shallow-controls__source-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.shallow-controls__error {
		margin: 0;
		color: var(--color-danger);
		font-size: var(--font-size-1);
		line-height: var(--line-height-base);
	}

	.shallow-controls__caption {
		color: var(--color-fg-secondary);
		font-size: var(--font-size-1);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.shallow-controls__select {
		width: 100%;
	}

	.shallow-controls__check {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--color-fg-secondary);
		font-size: var(--font-size-2);
	}

	.shallow-controls__list {
		margin: 0;
		padding-left: 18px;
	}
</style>