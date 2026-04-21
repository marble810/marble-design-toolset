<script lang="ts">
	import { LeftPanel, PreviewCanvas, RightPanel, Section } from '$lib/components/shell/index.js';
	import NoiseTextureCreaterPreview from './components/NoiseTextureCreaterPreview.svelte';
</script>

<LeftPanel>
	<Section title="Overview">
		<p class="noise-texture-creater__copy">
			This preview starter wires Noise Texture Creater into the shared shell with a fixed-size preview stage.
		</p>
	</Section>

	<Section title="Starter" collapsible>
		<ul class="noise-texture-creater__list">
			<li>Starter type: PreviewCanvas</li>
			<li>Declared tech stacks: pixi</li>
			<li>Replace the placeholder component with your tool UI.</li>
		</ul>
	</Section>
</LeftPanel>

<RightPanel>
	<PreviewCanvas contentWidth={512} contentHeight={512} label="Noise Texture Creater Preview">
		<NoiseTextureCreaterPreview />
	</PreviewCanvas>
</RightPanel>

<style>
	.noise-texture-creater__copy {
		margin: 0;
		color: var(--color-fg-secondary);
	}

	.noise-texture-creater__list {
		margin: 0;
		padding-left: 18px;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		color: var(--color-fg-secondary);
	}
</style>
