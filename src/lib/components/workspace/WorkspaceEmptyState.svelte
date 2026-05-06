<script lang="ts">
	import { Button, PixelIcon } from '$lib/components/ui/index.js';

	interface Props {
		onOpenTools: () => void;
	}

	let { onOpenTools }: Props = $props();
</script>

<div class="workspace-empty-state">
	<div class="workspace-empty-state__icon">
		<PixelIcon name="section" size={22} />
	</div>
	<h2 class="workspace-empty-state__title">Open a tool to start</h2>
	<p class="workspace-empty-state__copy">
		This workspace now runs on the new shell, runtime, and pixel UI foundation.
	</p>
	<Button variant="solid" size="md" onclick={onOpenTools}>
		<PixelIcon name="open" size={14} />
		<span>Browse Tools</span>
	</Button>
</div>

<style>
	.workspace-empty-state {
		display: grid;
		place-items: center;
		height: 100%;
		padding: var(--space-7);
		text-align: center;
	}

	.workspace-empty-state__title {
		margin: 0;
		font-size: 24px;
		line-height: 1.1;
	}

	.workspace-empty-state__copy {
		margin: 0;
		max-width: 520px;
		color: var(--color-fg-secondary);
		font-size: var(--font-size-3);
	}

	.workspace-empty-state__icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 52px;
		height: 52px;
		margin-bottom: var(--space-4);
		border: 1px solid rgba(149, 128, 255, 0.36);
		background: transparent;
		color: var(--color-accent-soft);
	}
</style>