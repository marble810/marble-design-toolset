<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ToolSourceInput } from '$lib/runtime/io/index.js';

	interface Props {
		source: ToolSourceInput;
		ariaLabel: string;
		class?: string;
		children?: Snippet;
	}

	let { source, ariaLabel, class: className = '', children }: Props = $props();
	let rootClass = $derived(`drop-zone${className ? ` ${className}` : ''}`);
</script>

<div
	class={rootClass}
	class:drop-zone--active={source.isDragOver}
	role="region"
	aria-label={ariaLabel}
	ondragover={source.handleDragOver}
	ondragleave={source.handleDragLeave}
	ondrop={source.handleDrop}
>
	{@render children?.()}
</div>

<style>
	.drop-zone {
		position: relative;
		display: flex;
		flex: 1 1 auto;
		min-width: 0;
		min-height: 0;
	}

	.drop-zone--active::after {
		content: '';
		position: absolute;
		inset: 4px;
		z-index: 10;
		border: 2px dashed var(--color-accent);
		border-radius: 4px;
		pointer-events: none;
	}
</style>