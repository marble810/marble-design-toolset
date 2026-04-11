<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children?: Snippet;
	}

	let { children }: Props = $props();
</script>

<section class="right-panel">
	{@render children?.()}
</section>

<style>
	.right-panel {
		display: flex;
		min-width: 0;
		min-height: 0;
	}
</style>