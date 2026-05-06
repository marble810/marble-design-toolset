<script lang="ts">
	import type { Snippet } from 'svelte';
	import { createCanvasExportRegistry } from '$lib/runtime/canvas-export/registry.svelte';
	import { setCanvasExportContext } from '$lib/runtime/canvas-export/context';

	interface Props {
		leftPanelWidthVw?: number;
		children?: Snippet;
	}

	let { leftPanelWidthVw = 28, children }: Props = $props();

	const canvasExportRegistry = createCanvasExportRegistry();
	setCanvasExportContext({
		get exporters() {
			return canvasExportRegistry.exporters;
		},
		register: (descriptor, options) => canvasExportRegistry.register(descriptor, options)
	});
</script>

<div class="tool-shell" style={`--tool-shell-left-panel-width:${leftPanelWidthVw}vw;`}>
	{@render children?.()}
</div>

<style>
	.tool-shell {
		display: grid;
		grid-template-columns: minmax(288px, var(--tool-shell-left-panel-width)) minmax(0, 1fr);
		grid-template-rows: 1fr;
		height: 100%;
		min-height: 0;
		gap: var(--space-2);
	}
</style>
