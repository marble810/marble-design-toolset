<script lang="ts">
	import { LeftPanel, PreviewCanvas, RightPanel } from '$lib/components/shell/index.js';
	import NoiseControls from './components/NoiseControls.svelte';
	import NoisePreview from './components/NoisePreview.svelte';
	import {
		PREVIEW_SIZE,
		VORONOI_PRESETS,
		createDefaultPerlinNoiseParameters,
		createDefaultSharedNoiseParameters,
		createDefaultVoronoiNoiseParameters,
		type NoiseFamily,
		type PerlinNoiseParameters,
		type SharedNoiseParameters,
		type VoronoiPreset,
		type VoronoiNoiseParameters
	} from './noise/shared.js';

	let activeFamily = $state<NoiseFamily>('perlin');
	let shared = $state<SharedNoiseParameters>(createDefaultSharedNoiseParameters());
	let perlin = $state<PerlinNoiseParameters>(createDefaultPerlinNoiseParameters());
	let voronoi = $state<VoronoiNoiseParameters>(createDefaultVoronoiNoiseParameters());

	function updateShared<Key extends keyof SharedNoiseParameters>(
		key: Key,
		value: SharedNoiseParameters[Key]
	) {
		shared = { ...shared, [key]: value };
	}

	function updatePerlin<Key extends keyof PerlinNoiseParameters>(
		key: Key,
		value: PerlinNoiseParameters[Key]
	) {
		perlin = { ...perlin, [key]: value };
	}

	function updateVoronoi<Key extends keyof VoronoiNoiseParameters>(
		key: Key,
		value: VoronoiNoiseParameters[Key]
	) {
		voronoi = { ...voronoi, [key]: value };
	}

	function applyVoronoiPreset(preset: VoronoiPreset) {
		activeFamily = 'voronoi';
		voronoi = { ...preset.parameters };
	}

	const previewLabel = $derived(
		activeFamily === 'perlin' ? 'Perlin Noise Preview' : 'Voronoi Noise Preview'
	);
</script>

<LeftPanel>
	<NoiseControls
		{activeFamily}
		{shared}
		{perlin}
		{voronoi}
		voronoiPresets={VORONOI_PRESETS}
		onFamilyChange={(family) => (activeFamily = family)}
		onSharedChange={updateShared}
		onPerlinChange={updatePerlin}
		onVoronoiChange={updateVoronoi}
		onVoronoiPresetSelect={applyVoronoiPreset}
	/>
</LeftPanel>

<RightPanel>
	<PreviewCanvas
		contentWidth={PREVIEW_SIZE}
		contentHeight={PREVIEW_SIZE}
		defaultZoom="1:1"
		label={previewLabel}
	>
		<NoisePreview {activeFamily} {shared} {perlin} {voronoi} />
	</PreviewCanvas>
</RightPanel>
