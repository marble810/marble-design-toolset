<script lang="ts">
	import { Tabs } from '$lib/components/ui/index.js';
	import type { WorkspaceTabItem } from '$lib/runtime/workspace-controller/index.js';

	interface Props {
		items: WorkspaceTabItem[];
		activeToolId: string;
		onActivate: (toolId: string) => void;
		onClose: (toolId: string) => void;
	}

	let { items, activeToolId, onActivate, onClose }: Props = $props();
	let selectedToolId = $state('');
	let lastActiveToolId = $state('');

	$effect(() => {
		if (activeToolId !== lastActiveToolId) {
			lastActiveToolId = activeToolId;
			selectedToolId = activeToolId;
		}
	});

	$effect(() => {
		if (selectedToolId && selectedToolId !== lastActiveToolId) {
			onActivate(selectedToolId);
		}
	});
</script>

<section class="workspace-tabs">
	{#if items.length > 0}
		<Tabs {items} bind:value={selectedToolId} onClose={onClose} />
	{:else}
		<div class="workspace-tabs__empty">No tools open</div>
	{/if}
</section>

<style>
	.workspace-tabs {
		display: flex;
		align-items: center;
		min-height: 36px;
		padding: var(--space-1) var(--space-3);
		overflow: hidden;
		background: var(--color-bg-panel);
		outline: 1px solid var(--color-border-soft);
		outline-offset: -1px;
	}

	.workspace-tabs__empty {
		color: var(--color-fg-muted);
		font-size: var(--font-size-2);
	}
</style>