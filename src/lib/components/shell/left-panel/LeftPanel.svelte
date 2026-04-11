<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getToolShellContext } from '$lib/runtime/tool-shell-context';
	import { MainInfo } from '../main-info/index.js';

	interface Props {
		children?: Snippet;
	}

	let { children }: Props = $props();
	const shellContext = getToolShellContext();
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
	</div>
</aside>

<style>
	.left-panel {
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: auto;
		gap: var(--space-3);
	}

	.left-panel__sections {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding-right: var(--space-1);
	}
</style>