<script lang="ts">
	import { LeftPanel, FullStage, RightPanel, Section } from '$lib/components/shell/index.js';
	import CubeViewport from './components/CubeViewport.svelte';
</script>

<LeftPanel>
	<Section title="Overview">
		<p class="three-cube__copy">
			This example proves the tool runtime can lazy-load Three.js and mount a live WebGL scene
			inside a full-bleed FullStage container.
		</p>
	</Section>

	<Section title="Scene" collapsible>
		<ul class="three-cube__list">
			<li>One spinning cube with directional lighting</li>
			<li>Resize-aware renderer bound to the FullStage container</li>
			<li>Tool owns the entire right panel area with no framework toolbar</li>
		</ul>
	</Section>
</LeftPanel>

<RightPanel>
	<FullStage>
		<CubeViewport />
	</FullStage>
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