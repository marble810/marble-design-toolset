<script lang="ts">
	import { LeftPanel, PreviewCanvas, RightPanel, Section } from '$lib/components/shell/index.js';
	import CubeViewport from './components/CubeViewport.svelte';
</script>

<LeftPanel>
	<Section title="Overview">
		<p class="three-cube__copy">
			This example proves the tool runtime can lazy-load Three.js and mount a live WebGL scene
			inside the shared preview canvas.
		</p>
	</Section>

	<Section title="Scene" collapsible>
		<ul class="three-cube__list">
			<li>One spinning cube with directional lighting</li>
			<li>Resize-aware renderer bound to the preview stage</li>
			<li>Shared toolbar still controls fit, zoom, and pan</li>
		</ul>
	</Section>
</LeftPanel>

<RightPanel>
	<PreviewCanvas contentWidth={720} contentHeight={480} label="Three.js Cube Demo">
		<CubeViewport />
	</PreviewCanvas>
</RightPanel>

<style>
	.three-cube__copy {
		margin: 0;
		color: var(--color-fg-secondary);
	}

	.three-cube__list {
		margin: 0;
		padding-left: 18px;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		color: var(--color-fg-secondary);
	}
</style>