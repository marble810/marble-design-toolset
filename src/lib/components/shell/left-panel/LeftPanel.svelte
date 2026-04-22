<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getToolShellContext } from '$lib/runtime/tool-shell-context';
	import { MainInfo } from '../main-info/index.js';
	import { ExportSection } from '../export-section/index.js';

	interface Props {
		children?: Snippet;
	}

	let { children }: Props = $props();
	const shellContext = getToolShellContext();

	const exportCapabilities = $derived(shellContext?.metadata?.export ?? {});
	const showExportSection = $derived(
		exportCapabilities.image === true || exportCapabilities.video === true
	);
</script>

<aside class="left-panel pixel-scrollbar">
	<MainInfo
		title={shellContext.metadata.name}
		description={shellContext.metadata.desc}
		menuActions={shellContext.menuActions}
		onAbout={shellContext.openAbout}
		onMenuAction={shellContext.onMenuAction}
	/>

	<div class="left-panel__sections">
		{@render children?.()}

		{#if showExportSection}
			<ExportSection {exportCapabilities} />
		{/if}
	</div>
</aside>

<style>
	.left-panel {
		--space-2: 3px;
		--space-3: 6px;
		--space-4: 10px;
		--space-5: 12px;
		--space-6: 18px;
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: auto;
		gap: var(--space-2);
		background-color: var(--color-bg-left-panel);
	}

	.left-panel__sections {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding-right: 0;
	}
</style>