<script lang="ts">
	import {
		createDefaultPresetInitMap,
		normalizePresetInitMap,
		type PresetInitMapDescriptor,
		type PresetInitMapKind
	} from '$lib/runtime/preset-init-map.js';
	import { onDestroy } from 'svelte';
	import { LeftPanel, PreviewCanvas, RightPanel } from '$lib/components/shell/index.js';
	import { createToolSourceInput } from '$lib/runtime/io/index.js';
	import { DropZone } from '$lib/components/tool-io/index.js';
	import ShallowWaterControls from './components/ShallowWaterControls.svelte';
	import ShallowWaterPreview from './components/ShallowWaterPreview.svelte';
	import {
		INIT_MAP_SOURCE_MODES,
		createDefaultShallowWaterParameters,
		normalizeParameters,
		type InitMapSourceMode,
		type ShallowWaterInitMapSource,
		type ShallowWaterParameters
	} from './simulation/shared.js';

	const sourceInput = createToolSourceInput({ allowedKinds: ['image'] });
	onDestroy(() => sourceInput.dispose());

	let parameters = $state<ShallowWaterParameters>(createDefaultShallowWaterParameters());
	let sourceMode = $state<InitMapSourceMode>(INIT_MAP_SOURCE_MODES[0]);
	let preset = $state<PresetInitMapDescriptor>(createDefaultPresetInitMap());
	let resimulateToken = $state(0);
	const imageItem = $derived(sourceInput.currentItem?.kind === 'image' ? sourceInput.currentItem : null);
	const normalizedParameters = $derived(normalizeParameters(parameters));
	const previewLabel = $derived(`Shallow Water Height - ${normalizedParameters.resolution}px sim`);
	const activeInitMapSource = $derived.by<ShallowWaterInitMapSource | null>(() => {
		if (sourceMode === 'image') {
			return imageItem ? { kind: 'image', objectUrl: imageItem.objectUrl } : null;
		}

		return { kind: 'preset', preset: normalizePresetInitMap(preset) };
	});

	function updateParameter<Key extends keyof ShallowWaterParameters>(
		key: Key,
		value: ShallowWaterParameters[Key]
	) {
		parameters = normalizeParameters({ ...parameters, [key]: value });
	}

	function resetParameters() {
		parameters = createDefaultShallowWaterParameters();
	}

	function resimulate() {
		resimulateToken += 1;
	}

	function updateSourceMode(mode: InitMapSourceMode) {
		sourceMode = mode;
	}

	function updatePreset(nextPreset: PresetInitMapDescriptor) {
		preset = normalizePresetInitMap(nextPreset);
	}

	function updatePresetKind(kind: PresetInitMapKind) {
		preset = createDefaultPresetInitMap(kind);
	}

	$effect(() => {
		if (sourceInput.currentItem?.kind === 'image') {
			sourceMode = 'image';
		}
	});
</script>

<LeftPanel>
	<ShallowWaterControls
		source={sourceInput}
		sourceMode={sourceMode}
		preset={preset}
		parameters={normalizedParameters}
		onParameterChange={updateParameter}
		onSourceModeChange={updateSourceMode}
		onPresetChange={updatePreset}
		onPresetKindChange={updatePresetKind}
		onResimulate={resimulate}
		onReset={resetParameters}
	/>
</LeftPanel>

<RightPanel>
	<PreviewCanvas
		contentWidth={normalizedParameters.resolution}
		contentHeight={normalizedParameters.resolution}
		defaultZoom="1:1"
		label={previewLabel}
	>
		<DropZone
			source={sourceInput}
			ariaLabel="Init map drop zone"
		>
			{#key normalizedParameters.resolution}
				<ShallowWaterPreview
					initMapSource={activeInitMapSource}
					sourceMode={sourceMode}
					parameters={normalizedParameters}
					resimulateToken={resimulateToken}
				/>
			{/key}
		</DropZone>
	</PreviewCanvas>
</RightPanel>