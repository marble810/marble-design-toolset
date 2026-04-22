<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
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

	function readNumber(event: Event, fallback: number): number {
		const target = event.currentTarget as HTMLInputElement | null;
		if (!target) {
			return fallback;
		}

		const parsed = Number(target.value);
		return Number.isFinite(parsed) ? parsed : fallback;
	}

	function readInteger(event: Event, fallback: number): number {
		return Math.round(readNumber(event, fallback));
	}

	function isVoronoiPresetActive(preset: VoronoiPreset): boolean {
		return Object.entries(preset.parameters).every(([key, value]) => voronoi[key as keyof VoronoiNoiseParameters] === value);
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
		<label class="noise-controls__field">
			<span class="noise-controls__caption">Seed</span>
			<input
				class="pixel-input"
				type="number"
				min="0"
				max="9999"
				step="1"
				value={shared.seed}
				oninput={(event) => onSharedChange('seed', readInteger(event, shared.seed))}
			/>
		</label>

		<label class="noise-controls__field">
			<span class="noise-controls__caption">Scale</span>
			<input
				class="pixel-input"
				type="number"
				min="0.5"
				max="18"
				step="0.1"
				value={shared.scale}
				oninput={(event) => onSharedChange('scale', readNumber(event, shared.scale))}
			/>
		</label>

		<label class="noise-controls__field">
			<span class="noise-controls__caption">Offset X</span>
			<input
				class="pixel-input"
				type="number"
				min="-4"
				max="4"
				step="0.05"
				value={shared.offsetX}
				oninput={(event) => onSharedChange('offsetX', readNumber(event, shared.offsetX))}
			/>
		</label>

		<label class="noise-controls__field">
			<span class="noise-controls__caption">Offset Y</span>
			<input
				class="pixel-input"
				type="number"
				min="-4"
				max="4"
				step="0.05"
				value={shared.offsetY}
				oninput={(event) => onSharedChange('offsetY', readNumber(event, shared.offsetY))}
			/>
		</label>

		<label class="noise-controls__field">
			<span class="noise-controls__caption">Brightness</span>
			<input
				class="pixel-input"
				type="number"
				min="-0.5"
				max="0.5"
				step="0.01"
				value={shared.brightness}
				oninput={(event) => onSharedChange('brightness', readNumber(event, shared.brightness))}
			/>
		</label>

		<label class="noise-controls__field">
			<span class="noise-controls__caption">Contrast</span>
			<input
				class="pixel-input"
				type="number"
				min="0.2"
				max="2.4"
				step="0.05"
				value={shared.contrast}
				oninput={(event) => onSharedChange('contrast', readNumber(event, shared.contrast))}
			/>
		</label>
	</div>
</Section>

{#if activeFamily === 'perlin'}
	<Section title="Perlin Parameters">
		<div class="noise-controls__grid">
			<label class="noise-controls__field">
				<span class="noise-controls__caption">Octaves</span>
				<input
					class="pixel-input"
					type="number"
					min="1"
					max="8"
					step="1"
					value={perlin.octaves}
					oninput={(event) => onPerlinChange('octaves', readInteger(event, perlin.octaves))}
				/>
			</label>

			<label class="noise-controls__field">
				<span class="noise-controls__caption">Persistence</span>
				<input
					class="pixel-input"
					type="number"
					min="0.1"
					max="0.95"
					step="0.01"
					value={perlin.persistence}
					oninput={(event) => onPerlinChange('persistence', readNumber(event, perlin.persistence))}
				/>
			</label>

			<label class="noise-controls__field">
				<span class="noise-controls__caption">Lacunarity</span>
				<input
					class="pixel-input"
					type="number"
					min="1.2"
					max="4"
					step="0.05"
					value={perlin.lacunarity}
					oninput={(event) => onPerlinChange('lacunarity', readNumber(event, perlin.lacunarity))}
				/>
			</label>

			<label class="noise-controls__field">
				<span class="noise-controls__caption">Exponent</span>
				<input
					class="pixel-input"
					type="number"
					min="0.4"
					max="3"
					step="0.05"
					value={perlin.exponent}
					oninput={(event) => onPerlinChange('exponent', readNumber(event, perlin.exponent))}
				/>
			</label>
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
			<label class="noise-controls__field">
				<span class="noise-controls__caption">Cell Density</span>
				<input
					class="pixel-input"
					type="number"
					min="2"
					max="48"
					step="1"
					value={voronoi.cellDensity}
					oninput={(event) =>
						onVoronoiChange('cellDensity', readInteger(event, voronoi.cellDensity))}
				/>
			</label>

			<label class="noise-controls__field">
				<span class="noise-controls__caption">Jitter</span>
				<input
					class="pixel-input"
					type="number"
					min="0"
					max="1"
					step="0.01"
					value={voronoi.jitter}
					oninput={(event) => onVoronoiChange('jitter', readNumber(event, voronoi.jitter))}
				/>
			</label>

			<label class="noise-controls__field">
				<span class="noise-controls__caption">Edge Width</span>
				<input
					class="pixel-input"
					type="number"
					min="0.01"
					max="0.4"
					step="0.01"
					value={voronoi.edgeWidth}
					oninput={(event) =>
						onVoronoiChange('edgeWidth', readNumber(event, voronoi.edgeWidth))}
				/>
			</label>

			<label class="noise-controls__field">
				<span class="noise-controls__caption">Edge Softness</span>
				<input
					class="pixel-input"
					type="number"
					min="0.001"
					max="0.4"
					step="0.005"
					value={voronoi.edgeSoftness}
					oninput={(event) =>
						onVoronoiChange('edgeSoftness', readNumber(event, voronoi.edgeSoftness))}
				/>
			</label>

			<label class="noise-controls__field">
				<span class="noise-controls__caption">Point Radius</span>
				<input
					class="pixel-input"
					type="number"
					min="0.2"
					max="1.8"
					step="0.05"
					value={voronoi.pointRadius}
					oninput={(event) =>
						onVoronoiChange('pointRadius', readNumber(event, voronoi.pointRadius))}
				/>
			</label>

			<label class="noise-controls__field">
				<span class="noise-controls__caption">Point Sharpness</span>
				<input
					class="pixel-input"
					type="number"
					min="0.4"
					max="4"
					step="0.05"
					value={voronoi.pointSharpness}
					oninput={(event) =>
						onVoronoiChange('pointSharpness', readNumber(event, voronoi.pointSharpness))}
				/>
			</label>

			<label class="noise-controls__field">
				<span class="noise-controls__caption">Fill Strength</span>
				<input
					class="pixel-input"
					type="number"
					min="0"
					max="1"
					step="0.01"
					value={voronoi.fillStrength}
					oninput={(event) =>
						onVoronoiChange('fillStrength', readNumber(event, voronoi.fillStrength))}
				/>
			</label>

			<label class="noise-controls__field">
				<span class="noise-controls__caption">Cell Variation</span>
				<input
					class="pixel-input"
					type="number"
					min="0"
					max="1"
					step="0.01"
					value={voronoi.cellVariation}
					oninput={(event) =>
						onVoronoiChange('cellVariation', readNumber(event, voronoi.cellVariation))}
				/>
			</label>
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
		grid-template-columns: repeat(2, minmax(0, 1fr));
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

	.noise-controls__field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.noise-controls__caption {
		color: var(--color-fg-secondary);
		font-size: var(--font-size-1);
		text-transform: uppercase;
		letter-spacing: 0.08em;
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