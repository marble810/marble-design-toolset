<script lang="ts">
	import { LeftPanel, PreviewCanvas, RightPanel, Section } from '$lib/components/shell/index.js';
	
	import { Application, Assets, Sprite } from 'pixi.js';

	(async () =>{
		const app = new Application();
		
		await app.init({
			background: '#0000000', resizeTo: window
		});

		document.body.appendChild(app.canvas);
	})

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
