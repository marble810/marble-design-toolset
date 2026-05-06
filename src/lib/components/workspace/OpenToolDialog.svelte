<script lang="ts">
	import { Dialog, PixelIcon } from '$lib/components/ui/index.js';
	import type { ToolCatalogItem } from '$lib/types/tool';

	interface Props {
		open: boolean;
		toolCatalog: ToolCatalogItem[];
		onOpenTool: (toolId: string) => void;
	}

	let { open = $bindable(false), toolCatalog, onOpenTool }: Props = $props();
</script>

<Dialog
	bind:open
	title="Open Tool"
	description="Choose a tool to mount inside the shared workspace shell."
	width="lg"
>
	<div class="tool-catalog pixel-scrollbar">
		{#each toolCatalog as tool}
			<button type="button" class="tool-card" onclick={() => onOpenTool(tool.id)}>
				<div class="tool-card__header">
					<div>
						<h3 class="tool-card__title">{tool.name}</h3>
						<p class="tool-card__description">{tool.desc}</p>
					</div>
					<span class="tool-card__version">v{tool.version}</span>
				</div>

				<div class="tool-card__footer">
					<div class="tool-card__tags">
						{#each tool.tag as tag}
							<span class="pixel-chip">{tag}</span>
						{/each}
					</div>
					<span class="tool-card__cta">
						Open
						<PixelIcon name="arrow-right" size={12} />
					</span>
				</div>
			</button>
		{/each}
	</div>
</Dialog>

<style>
	.tool-catalog {
		display: grid;
		gap: var(--space-3);
		max-height: 58vh;
		overflow: auto;
	}

	.tool-card {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		width: 100%;
		padding: var(--space-4);
		border: var(--border-width-inner) solid var(--color-border-soft);
		background: rgba(255, 255, 255, 0.02);
		color: var(--color-fg-primary);
		text-align: left;
		cursor: pointer;
		transition:
			border-color var(--duration-fast) var(--easing-standard),
			transform var(--duration-fast) var(--easing-standard),
			background var(--duration-fast) var(--easing-standard);
	}

	.tool-card:hover {
		transform: translateY(-1px);
		border-color: rgba(149, 128, 255, 0.46);
		background: rgba(149, 128, 255, 0.08);
	}

	.tool-card__header,
	.tool-card__footer {
		display: flex;
		justify-content: space-between;
		gap: var(--space-4);
	}

	.tool-card__title {
		margin: 0 0 var(--space-2);
		font-size: var(--font-size-3);
	}

	.tool-card__description {
		margin: 0;
		color: var(--color-fg-secondary);
	}

	.tool-card__version {
		color: var(--color-fg-muted);
		font-size: var(--font-size-1);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.tool-card__tags {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.tool-card__cta {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--color-accent-soft);
		font-size: var(--font-size-2);
	}
</style>