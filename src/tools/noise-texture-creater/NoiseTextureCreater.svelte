<script lang="ts">
	import { LeftPanel, PreviewCanvas, RightPanel, Section } from '$lib/components/shell/index.js';
	import NoisePreview from './components/NoisePreview.svelte';
</script>

<LeftPanel>
	<Section title="Overview">
		<p class="noise-texture-creater__copy">
			This preview demonstrates how a tool registers a `kind: 'render'` exporter so the framework
			Export control can produce PNG (8-bit / 16-bit if declared) and MP4 / WebM directly from the
			tool's renderFrame callback.
		</p>
	</Section>

	<Section title="Starter" collapsible>
		<ul class="noise-texture-creater__list">
			<li>Starter type: PreviewCanvas</li>
			<li>Frame source: render-frame callback</li>
			<li>Tool only owns the noise renderer; export UI is framework-owned.</li>
		</ul>
	</Section>
</LeftPanel>

<RightPanel>
	<PreviewCanvas contentWidth={512} contentHeight={512} label="Noise Texture Creater Preview">
		<NoisePreview width={512} height={512} />
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
