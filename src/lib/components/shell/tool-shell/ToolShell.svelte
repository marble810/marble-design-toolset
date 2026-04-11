<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		leftPanelWidthVw?: number;
		children?: Snippet;
	}

	let { leftPanelWidthVw = 28, children }: Props = $props();
</script>

<div class="tool-shell" style={`--tool-shell-left-panel-width:${leftPanelWidthVw}vw;`}>
	{@render children?.()}
</div>

<style>
	.tool-shell {
		display: grid;
		grid-template-columns: minmax(288px, var(--tool-shell-left-panel-width)) minmax(0, 1fr);
		height: 100%;
		min-height: 0;
		gap: var(--space-4);
	}
</style>