<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Section } from '$lib/components/shell/section/index.js';
	import type { ToolSourceInput, ToolSourceSlot, ToolSourceSlotCollection } from '$lib/runtime/io/index.js';

	interface Props {
		source: ToolSourceInput | ToolSourceSlotCollection;
		title?: string;
		emptyHint?: string;
		browseLabel?: string;
		replaceLabel?: string;
		clearLabel?: string;
	}

	let {
		source,
		title = 'Source',
		emptyHint = 'Drop a file onto the preview, or browse to load one.',
		browseLabel = 'Browse...',
		replaceLabel = 'Replace',
		clearLabel = 'Clear'
	}: Props = $props();

	const isMultiSlot = $derived(source.mode === 'slots');

	function sourceSlots(): readonly ToolSourceSlot[] {
		return source.mode === 'slots' ? source.slots : [];
	}

	function singleSource(): ToolSourceInput | null {
		return source.mode === 'slots' ? null : source;
	}
</script>

<Section {title}>
	<div class="source-input-section">
		{#if isMultiSlot}
			{#each sourceSlots() as slot (slot.id)}
				<div class="source-input-section__slot">
					<div class="source-input-section__slot-head">
						<span class="source-input-section__slot-name">{slot.name}</span>
						{#if slot.required}
							<span class="source-input-section__required">Required</span>
						{/if}
					</div>
					<p class="source-input-section__hint">{slot.desc}</p>

					{#if slot.summary}
						<div class="source-input-section__info">
							<span class="source-input-section__name">{slot.summary.name}</span>
							<span class="source-input-section__meta">{slot.summary.detail}</span>
						</div>
						<div class="source-input-section__actions">
							<Button variant="ghost" size="sm" disabled={slot.busy} onclick={() => void slot.pick()}>
								{replaceLabel}
							</Button>
							<Button variant="ghost" size="sm" disabled={slot.busy} onclick={() => slot.clear()}>
								{clearLabel}
							</Button>
						</div>
					{:else}
						<Button variant="outline" size="sm" disabled={slot.busy} onclick={() => void slot.pick()}>
							{slot.busy ? 'Loading...' : browseLabel}
						</Button>
					{/if}

					{#if slot.lastError}
						<p class="source-input-section__error">{slot.lastError.message}</p>
					{/if}
				</div>
			{/each}
		{:else}
			{@const currentSource = singleSource()}
			{#if currentSource}
				{#if currentSource.summary}
					<div class="source-input-section__info">
						<span class="source-input-section__name">{currentSource.summary.name}</span>
						<span class="source-input-section__meta">{currentSource.summary.detail}</span>
					</div>
					<div class="source-input-section__actions">
						<Button variant="ghost" size="sm" disabled={currentSource.busy} onclick={() => void currentSource.pick()}>
							{replaceLabel}
						</Button>
						<Button variant="ghost" size="sm" disabled={currentSource.busy} onclick={() => currentSource.clear()}>
							{clearLabel}
						</Button>
					</div>
				{:else}
					<p class="source-input-section__hint">{emptyHint}</p>
					<Button variant="outline" size="sm" disabled={currentSource.busy} onclick={() => void currentSource.pick()}>
						{currentSource.busy ? 'Loading...' : browseLabel}
					</Button>
				{/if}

				{#if currentSource.lastError}
					<p class="source-input-section__error">{currentSource.lastError.message}</p>
				{/if}
			{/if}
		{/if}
	</div>
</Section>

<style>
	.source-input-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-1) 0;
	}

	.source-input-section__info {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.source-input-section__name {
		color: var(--color-fg-primary);
		font-size: var(--font-size-1);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.source-input-section__meta,
	.source-input-section__hint {
		margin: 0;
		color: var(--color-fg-muted);
		font-size: var(--font-size-1);
		line-height: var(--line-height-base);
	}

	.source-input-section__actions {
		display: flex;
		gap: var(--space-2);
	}

	.source-input-section__slot {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-2);
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.02);
	}

	.source-input-section__slot-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}

	.source-input-section__slot-name,
	.source-input-section__required {
		color: var(--color-fg-secondary);
		font-size: var(--font-size-1);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.source-input-section__required {
		color: var(--color-accent);
	}

	.source-input-section__error {
		margin: 0;
		color: var(--color-danger);
		font-size: var(--font-size-1);
	}
</style>
