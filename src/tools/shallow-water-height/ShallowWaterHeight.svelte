<script lang="ts">
	import { onDestroy } from 'svelte';
	import { LeftPanel, PreviewCanvas, RightPanel } from '$lib/components/shell/index.js';
	import {
		createFileInputController,
		extractDroppedFiles
	} from '$lib/runtime/file-input/index.js';
	import ShallowWaterControls from './components/ShallowWaterControls.svelte';
	import ShallowWaterPreview from './components/ShallowWaterPreview.svelte';
	import {
		OUTPUT_SIZE,
		createDefaultShallowWaterParameters,
		normalizeParameters,
		type ShallowWaterParameters
	} from './simulation/shared.js';

	const fileInput = createFileInputController({ allowedKinds: ['image'] });
	onDestroy(() => fileInput.dispose());

	let parameters = $state<ShallowWaterParameters>(createDefaultShallowWaterParameters());
	const imageItem = $derived(fileInput.currentItem?.kind === 'image' ? fileInput.currentItem : null);
	const normalizedParameters = $derived(normalizeParameters(parameters));
	const previewLabel = $derived(
		imageItem ? `Shallow Water Height - ${normalizedParameters.resolution}px sim` : 'Shallow Water Height'
	);

	function updateParameter<Key extends keyof ShallowWaterParameters>(
		key: Key,
		value: ShallowWaterParameters[Key]
	) {
		parameters = normalizeParameters({ ...parameters, [key]: value });
	}

	function resetParameters() {
		parameters = createDefaultShallowWaterParameters();
	}

	function handlePreviewDrop(event: DragEvent) {
		event.preventDefault();
		void fileInput.ingestFiles(extractDroppedFiles(event), 'drop');
	}

	function handlePreviewDragOver(event: DragEvent) {
		event.preventDefault();
	}
</script>

<LeftPanel>
	<ShallowWaterControls
		fileInput={fileInput}
		imageItem={imageItem}
		parameters={normalizedParameters}
		onParameterChange={updateParameter}
		onReset={resetParameters}
	/>
</LeftPanel>

<RightPanel>
	<PreviewCanvas
		contentWidth={OUTPUT_SIZE}
		contentHeight={OUTPUT_SIZE}
		defaultZoom="1:1"
		label={previewLabel}
	>
		<div
			class="shallow-water-height__drop-host"
			role="region"
			aria-label="Init map drop zone"
			ondragover={handlePreviewDragOver}
			ondrop={handlePreviewDrop}
		>
			<ShallowWaterPreview imageItem={imageItem} parameters={normalizedParameters} />
		</div>
	</PreviewCanvas>
</RightPanel>

<style>
	.shallow-water-height__drop-host {
		width: 100%;
		height: 100%;
	}
</style>