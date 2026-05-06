<script lang="ts">
	import {
		PRESET_INIT_MAP_KINDS,
		type PresetInitMapDescriptor,
		type PresetInitMapKind
	} from '$lib/runtime/preset-init-map.js';
	import { Section } from '$lib/components/shell/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { SliderField } from '$lib/components/ui/slider-field/index.js';
	import type { FileInputController } from '$lib/runtime/file-input/index.js';
	import type { ImportedImageFileItem } from '$lib/types/file-input';
	import {
		INIT_MAP_SOURCE_MODES,
		RESOLUTION_OPTIONS,
		type InitMapSourceMode,
		type ShallowWaterParameters,
		type SimulationResolution
	} from '../simulation/shared.js';

	interface Props {
		fileInput: FileInputController;
		imageItem: ImportedImageFileItem | null;
		sourceMode: InitMapSourceMode;
		preset: PresetInitMapDescriptor;
		parameters: ShallowWaterParameters;
		onParameterChange: <Key extends keyof ShallowWaterParameters>(
			key: Key,
			value: ShallowWaterParameters[Key]
		) => void;
		onSourceModeChange: (mode: InitMapSourceMode) => void;
		onPresetChange: (preset: PresetInitMapDescriptor) => void;
		onPresetKindChange: (kind: PresetInitMapKind) => void;
		onResimulate: () => void;
		onReset: () => void;
	}

	let {
		fileInput,
		imageItem,
		sourceMode,
		preset,
		parameters,
		onParameterChange,
		onSourceModeChange,
		onPresetChange,
		onPresetKindChange,
		onResimulate,
		onReset
	}: Props = $props();

	const SOURCE_MODE_LABELS: Record<InitMapSourceMode, string> = {
		preset: 'Preset',
		image: 'Image'
	};

	const PRESET_KIND_LABELS: Record<PresetInitMapKind, string> = {
		circle: 'Circle',
		square: 'Square',
		'horizontal-bar': 'Horizontal Bar',
		'vertical-bar': 'Vertical Bar'
	};

	function formatBytes(size: number): string {
		if (size < 1024) return `${size} B`;
		if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
		return `${(size / (1024 * 1024)).toFixed(1)} MB`;
	}

	function updatePresetValue(nextPreset: PresetInitMapDescriptor) {
		onPresetChange(nextPreset);
	}
</script>

<Section title="Init Map">
	<div class="shallow-controls__source">
		<label class="shallow-controls__field">
			<span class="shallow-controls__caption">Source</span>
			<select
				class="pixel-input shallow-controls__select"
				value={sourceMode}
				onchange={(event) =>
					onSourceModeChange((event.currentTarget as HTMLSelectElement).value as InitMapSourceMode)}
			>
				{#each INIT_MAP_SOURCE_MODES as mode}
					<option value={mode}>{SOURCE_MODE_LABELS[mode]}</option>
				{/each}
			</select>
		</label>

		{#if sourceMode === 'image'}
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
				<Button
					variant="outline"
					size="sm"
					onclick={() => void fileInput.pick()}
					disabled={fileInput.busy}
				>
					{fileInput.busy ? 'Loading...' : 'Browse...'}
				</Button>
			{/if}

			{#if fileInput.lastError}
				<p class="shallow-controls__error">{fileInput.lastError.message}</p>
			{/if}
		{:else}
			<p class="shallow-controls__hint">
				Use a procedural preset init map at the current simulation resolution.
			</p>

			<label class="shallow-controls__field">
				<span class="shallow-controls__caption">Preset</span>
				<select
					class="pixel-input shallow-controls__select"
					value={preset.kind}
					onchange={(event) =>
						onPresetKindChange(
							(event.currentTarget as HTMLSelectElement).value as PresetInitMapKind
						)}
				>
					{#each PRESET_INIT_MAP_KINDS as kind}
						<option value={kind}>{PRESET_KIND_LABELS[kind]}</option>
					{/each}
				</select>
			</label>

			{#if preset.kind === 'circle' || preset.kind === 'square'}
				<label class="shallow-controls__field">
					<span class="shallow-controls__caption">Mode</span>
					<select
						class="pixel-input shallow-controls__select"
						value={preset.mode}
						onchange={(event) =>
							updatePresetValue({
								...preset,
								mode: (event.currentTarget as HTMLSelectElement).value as 'fill' | 'outline'
							})}
					>
						<option value="fill">Fill</option>
						<option value="outline">Outline</option>
					</select>
				</label>
				<SliderField
					label="Position X"
					min={0}
					max={1}
					step={0.01}
					value={preset.centerX}
					onchange={(value) => updatePresetValue({ ...preset, centerX: value })}
				/>
				<SliderField
					label="Position Y"
					min={0}
					max={1}
					step={0.01}
					value={preset.centerY}
					onchange={(value) => updatePresetValue({ ...preset, centerY: value })}
				/>
				<SliderField
					label="Size"
					min={0.02}
					max={1}
					step={0.01}
					value={preset.size}
					onchange={(value) => updatePresetValue({ ...preset, size: value })}
				/>
				{#if preset.mode === 'outline'}
					<SliderField
						label="Outline Width"
						min={0.002}
						max={0.12}
						step={0.002}
						value={preset.outlineWidth}
						onchange={(value) => updatePresetValue({ ...preset, outlineWidth: value })}
					/>
				{/if}
				<SliderField
					label="Feather"
					min={0}
					max={0.5}
					step={0.01}
					value={preset.feather}
					onchange={(value) => updatePresetValue({ ...preset, feather: value })}
				/>
			{:else}
				<SliderField
					label={preset.kind === 'horizontal-bar' ? 'Position Y' : 'Position X'}
					min={0}
					max={1}
					step={0.01}
					value={preset.position}
					onchange={(value) => updatePresetValue({ ...preset, position: value })}
				/>
				<SliderField
					label="Thickness"
					min={0.01}
					max={1}
					step={0.01}
					value={preset.thickness}
					onchange={(value) => updatePresetValue({ ...preset, thickness: value })}
				/>
				<SliderField
					label="Feather"
					min={0}
					max={0.5}
					step={0.01}
					value={preset.feather}
					onchange={(value) => updatePresetValue({ ...preset, feather: value })}
				/>
			{/if}
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
			label="Rest Threshold"
			min={0}
			max={0.01}
			step={0.00001}
			value={parameters.restThreshold}
			onchange={(value) => onParameterChange('restThreshold', value)}
		/>
		<SliderField
			label="Edge Absorb"
			min={0}
			max={1}
			step={0.01}
			value={parameters.edgeAbsorb}
			onchange={(value) => onParameterChange('edgeAbsorb', value)}
		/>
		<SliderField
			label="Steps / Frame"
			min={1}
			max={8}
			step={1}
			value={parameters.stepsPerFrame}
			onchange={(value) => onParameterChange('stepsPerFrame', Math.round(value))}
		/>
		<Button variant="outline" size="sm" onclick={onResimulate}>Resimulate</Button>
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
		<li>Preview frame: {parameters.resolution} x {parameters.resolution} px</li>
		<li>Boundary: absorbing edge, no reflection</li>
		<li>Export: MP4/WebM via framework</li>
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