<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Section } from '$lib/components/shell/section/index.js';
	import type { ToolSourceInput } from '$lib/runtime/io/index.js';

	interface Props {
		source: ToolSourceInput;
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
</script>

<Section {title}>
	<div class="source-input-section">
		{#if source.summary}
			<div class="source-input-section__info">
				<span class="source-input-section__name">{source.summary.name}</span>
				<span class="source-input-section__meta">{source.summary.detail}</span>
			</div>
			<div class="source-input-section__actions">
				<Button variant="ghost" size="sm" disabled={source.busy} onclick={() => void source.pick()}>
					{replaceLabel}
				</Button>
				<Button variant="ghost" size="sm" disabled={source.busy} onclick={() => source.clear()}>
					{clearLabel}
				</Button>
			</div>
		{:else}
			<p class="source-input-section__hint">{emptyHint}</p>
			<Button variant="outline" size="sm" disabled={source.busy} onclick={() => void source.pick()}>
				{source.busy ? 'Loading...' : browseLabel}
			</Button>
		{/if}

		{#if source.lastError}
			<p class="source-input-section__error">{source.lastError.message}</p>
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

	.source-input-section__error {
		margin: 0;
		color: var(--color-danger);
		font-size: var(--font-size-1);
	}
</style>