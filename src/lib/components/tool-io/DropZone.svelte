<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ToolSourceInput, ToolSourceSlotCollection } from '$lib/runtime/io/index.js';

	interface Props {
		source: ToolSourceInput | ToolSourceSlotCollection;
		slotId?: string;
		ariaLabel: string;
		class?: string;
		children?: Snippet;
	}

	let { source, slotId, ariaLabel, class: className = '', children }: Props = $props();
	const zoneSource = $derived.by(() => {
		if (source.mode !== 'slots') {
			return source;
		}
		if (!slotId) {
			throw new Error('DropZone requires slotId when bound to a multi-slot source workflow.');
		}
		const slot = source.getSlot(slotId);
		if (!slot) {
			throw new Error(`Unknown DropZone source slot: ${slotId}`);
		}
		return slot;
	});
	let rootClass = $derived(`drop-zone${className ? ` ${className}` : ''}`);
</script>

<div
	class={rootClass}
	class:drop-zone--active={zoneSource.isDragOver}
	role="region"
	aria-label={ariaLabel}
	ondragover={zoneSource.handleDragOver}
	ondragleave={zoneSource.handleDragLeave}
	ondrop={zoneSource.handleDrop}
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
