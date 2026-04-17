<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children?: Snippet;
	}

	let { children }: Props = $props();
</script>

<div class="full-stage">
	{@render children?.()}
</div>

<style>
	.full-stage {
		position: relative;
		display: flex;
		flex: 1 1 auto;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
	}
</style>
