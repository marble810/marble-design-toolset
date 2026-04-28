<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { SliderField } from '$lib/components/ui/slider-field/index.js';
	import { Section } from '$lib/components/shell/section/index.js';
	import type {
		NoiseFamily,
		PerlinNoiseParameters,
		SharedNoiseParameters,
		VoronoiPreset,
		VoronoiNoiseParameters
	} from '../noise/shared.js';

	interface Props {
		activeFamily: NoiseFamily;
		shared: SharedNoiseParameters;
		perlin: PerlinNoiseParameters;
		voronoi: VoronoiNoiseParameters;
		voronoiPresets: VoronoiPreset[];
		onFamilyChange: (family: NoiseFamily) => void;
		onSharedChange: <Key extends keyof SharedNoiseParameters>(
			key: Key,
			value: SharedNoiseParameters[Key]
		) => void;
		onPerlinChange: <Key extends keyof PerlinNoiseParameters>(
			key: Key,
			value: PerlinNoiseParameters[Key]
		) => void;
		onVoronoiChange: <Key extends keyof VoronoiNoiseParameters>(
			key: Key,
			value: VoronoiNoiseParameters[Key]
		) => void;
		onVoronoiPresetSelect: (preset: VoronoiPreset) => void;
	}

	let {
		activeFamily,
		shared,
		perlin,
		voronoi,
		voronoiPresets,
		onFamilyChange,
		onSharedChange,
		onPerlinChange,
		onVoronoiChange,
		onVoronoiPresetSelect
	}: Props = $props();

	function isVoronoiPresetActive(preset: VoronoiPreset): boolean {
		return Object.entries(preset.parameters).every(
			([key, value]) => voronoi[key as keyof VoronoiNoiseParameters] === value
		);
	}
</script>

<Section title="Noise Family">
	<div class="noise-controls__family-switcher">
		<Button
			variant={activeFamily === 'perlin' ? 'solid' : 'outline'}
			size="sm"
			onclick={() => onFamilyChange('perlin')}
		>
			Perlin Noise
		</Button>
		<Button
			variant={activeFamily === 'voronoi' ? 'solid' : 'outline'}
			size="sm"
			onclick={() => onFamilyChange('voronoi')}
		>
			Voronoi Noise
		</Button>
	</div>
	<p class="noise-controls__hint">
		Preview stays fixed at 512 x 512. Export is PNG only, with 8-bit and 16-bit output.
	</p>
</Section>

<Section title="Shared Parameters">
	<div class="noise-controls__grid">
		<SliderField
			label="Seed"
			min={0}
			max={9999}
			step={1}
			hardMin={0}
			hardMax={9999}
			value={shared.seed}
			onchange={(value) => onSharedChange('seed', Math.round(value))}
		/>
		<SliderField
			label="Scale"
			min={0.5}
			max={18}
			step={0.1}
			value={shared.scale}
			onchange={(value) => onSharedChange('scale', value)}
		/>
		<SliderField
			label="Offset X"
			min={-4}
			max={4}
			step={0.05}
			value={shared.offsetX}
			onchange={(value) => onSharedChange('offsetX', value)}
		/>
		<SliderField
			label="Offset Y"
			min={-4}
			max={4}
			step={0.05}
			value={shared.offsetY}
			onchange={(value) => onSharedChange('offsetY', value)}
		/>
		<SliderField
			label="Brightness"
			min={-0.5}
			max={0.5}
			step={0.01}
			value={shared.brightness}
			onchange={(value) => onSharedChange('brightness', value)}
		/>
		<SliderField
			label="Contrast"
			min={0.2}
			max={2.4}
			step={0.05}
			value={shared.contrast}
			onchange={(value) => onSharedChange('contrast', value)}
		/>
	</div>
</Section>

{#if activeFamily === 'perlin'}
	<Section title="Perlin Parameters">
		<div class="noise-controls__grid">
			<SliderField
				label="Octaves"
				min={1}
				max={8}
				step={1}
				hardMin={1}
				hardMax={8}
				value={perlin.octaves}
				onchange={(value) => onPerlinChange('octaves', Math.round(value))}
			/>
			<SliderField
				label="Persistence"
				min={0.1}
				max={0.95}
				step={0.01}
				value={perlin.persistence}
				onchange={(value) => onPerlinChange('persistence', value)}
			/>
			<SliderField
				label="Lacunarity"
				min={1.2}
				max={4}
				step={0.05}
				value={perlin.lacunarity}
				onchange={(value) => onPerlinChange('lacunarity', value)}
			/>
			<SliderField
				label="Exponent"
				min={0.4}
				max={3}
				step={0.05}
				value={perlin.exponent}
				onchange={(value) => onPerlinChange('exponent', value)}
			/>
		</div>
	</Section>
{:else}
	<Section title="Voronoi Presets" collapsible>
		<p class="noise-controls__hint noise-controls__hint--compact">
			Use a preset as a starting point, then fine-tune the values below.
		</p>
		<div class="noise-controls__preset-grid">
			{#each voronoiPresets as preset (preset.id)}
				<Button
					variant={isVoronoiPresetActive(preset) ? 'solid' : 'outline'}
					size="sm"
					title={preset.description}
					onclick={() => onVoronoiPresetSelect(preset)}
				>
					{preset.label}
				</Button>
			{/each}
		</div>
	</Section>

	<Section title="Voronoi Parameters">
		<div class="noise-controls__grid">
			<SliderField
				label="Cell Density"
				min={2}
				max={48}
				step={1}
				value={voronoi.cellDensity}
				onchange={(value) => onVoronoiChange('cellDensity', Math.round(value))}
			/>
			<SliderField
				label="Jitter"
				min={0}
				max={1}
				step={0.01}
				value={voronoi.jitter}
				onchange={(value) => onVoronoiChange('jitter', value)}
			/>
			<SliderField
				label="Edge Width"
				min={0.01}
				max={0.4}
				step={0.01}
				value={voronoi.edgeWidth}
				onchange={(value) => onVoronoiChange('edgeWidth', value)}
			/>
			<SliderField
				label="Edge Softness"
				min={0.001}
				max={0.4}
				step={0.005}
				value={voronoi.edgeSoftness}
				onchange={(value) => onVoronoiChange('edgeSoftness', value)}
			/>
			<SliderField
				label="Point Radius"
				min={0.2}
				max={1.8}
				step={0.05}
				value={voronoi.pointRadius}
				onchange={(value) => onVoronoiChange('pointRadius', value)}
			/>
			<SliderField
				label="Point Sharpness"
				min={0.4}
				max={4}
				step={0.05}
				value={voronoi.pointSharpness}
				onchange={(value) => onVoronoiChange('pointSharpness', value)}
			/>
			<SliderField
				label="Fill Strength"
				min={0}
				max={1}
				step={0.01}
				value={voronoi.fillStrength}
				onchange={(value) => onVoronoiChange('fillStrength', value)}
			/>
			<SliderField
				label="Cell Variation"
				min={0}
				max={1}
				step={0.01}
				value={voronoi.cellVariation}
				onchange={(value) => onVoronoiChange('cellVariation', value)}
			/>
		</div>
	</Section>
{/if}

<Section title="Output" collapsible>
	<ul class="noise-controls__list">
		<li>Preview size: 512 x 512</li>
		<li>Aspect ratio: 1:1 square</li>
		<li>Export: PNG 8-bit / 16-bit</li>
	</ul>
</Section>

<style>
	.noise-controls__family-switcher {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.noise-controls__hint {
		margin: var(--space-3) 0 0;
		color: var(--color-fg-muted);
		font-size: var(--font-size-1);
		line-height: var(--line-height-base);
	}

	.noise-controls__grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-3);
	}

	.noise-controls__preset-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-2);
		margin-top: var(--space-3);
	}

	.noise-controls__hint--compact {
		margin-top: 0;
	}

	.noise-controls__list {
		margin: 0;
		padding-left: 18px;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		color: var(--color-fg-secondary);
	}
</style>
