<script lang="ts">
	/**
	 * Forge demo Standard Inspector renderer (Web adapter): renders the retained
	 * InspectorHost view model. Pointer input is coalesced locally and flushed on rAF /
	 * pointer completion — individual pointer events never cross the Environment API.
	 */
	import { onMount } from 'svelte';
	import type { CatalogEntry, InspectorBinding, ParameterDescriptor } from 'tool-contract';
	import type { InspectorHost, InspectorNodeState, InspectorViewModel, ParameterStore } from 'tool-host';

	interface Props {
		entry: CatalogEntry;
		store: ParameterStore;
		inspector: InspectorHost;
	}

	let { entry, store, inspector }: Props = $props();

	interface ControlMeta {
		parameterId?: string;
		min?: number;
		max?: number;
		step?: number;
		options?: readonly string[];
	}

	let model: InspectorViewModel = $state({ elements: [] });
	const metaById = new Map<string, ControlMeta>();

	for (const element of flatten(entry.inspectorTree.elements)) {
		const binding = (element as { binding?: InspectorBinding }).binding;
		const meta: ControlMeta = {};
		if (binding !== undefined && binding.kind === 'parameter') {
			meta.parameterId = binding.parameterId;
			const descriptor: ParameterDescriptor | undefined = store.descriptor(binding.parameterId);
			if (descriptor !== undefined && descriptor.constraint.type === 'number') {
				meta.min = descriptor.constraint.min;
				meta.max = descriptor.constraint.max;
				meta.step = descriptor.constraint.step ?? 0.01;
			}
			if (descriptor !== undefined && descriptor.constraint.type === 'select') {
				meta.options = descriptor.constraint.options;
			}
		}
		metaById.set(element.id, meta);
	}

	function flatten(elements: readonly InspectorElement[]): InspectorElement[] {
		const out: InspectorElement[] = [];
		for (const element of elements) {
			out.push(element);
			if (element.kind === 'section') out.push(...flatten(element.children));
		}
		return out;
	}

	function nodeMeta(id: string): ControlMeta {
		return metaById.get(id) ?? {};
	}

	let flushScheduled = false;
	function scheduleFlush(): void {
		if (flushScheduled) return;
		flushScheduled = true;
		requestAnimationFrame(() => {
			flushScheduled = false;
			inspector.flushValues();
		});
	}

	function onSliderInput(node: InspectorNodeState, event: Event): void {
		const value = Number((event.target as HTMLInputElement).value);
		inspector.setValue(node.id, value);
		scheduleFlush();
	}

	function onSliderCommit(node: InspectorNodeState): void {
		// Pointer completion always flushes immediately (rAF coalescing is the fast path).
		inspector.flushValues();
		void node;
	}

	function onToggle(node: InspectorNodeState, event: Event): void {
		inspector.setValue(node.id, (event.target as HTMLInputElement).checked);
		scheduleFlush();
	}

	function onSelect(node: InspectorNodeState, event: Event): void {
		inspector.setValue(node.id, (event.target as HTMLSelectElement).value);
		scheduleFlush();
	}

	function onText(node: InspectorNodeState, event: Event): void {
		inspector.setValue(node.id, (event.target as HTMLInputElement).value);
		scheduleFlush();
	}

	function onButton(node: InspectorNodeState): void {
		const result = inspector.trigger(node.id);
		void result;
		scheduleFlush();
	}

	onMount(() => {
		model = inspector.viewModel();
		return inspector.subscribe((next) => {
			model = next;
		});
	});
</script>

<div class="forge-inspector">
	{#each model.elements as node (node.id)}
		{#if node.visible !== false}
			{@render renderNode(node)}
		{/if}
	{/each}
</div>

{#snippet renderNode(node: InspectorNodeState)}
	{@const meta = nodeMeta(node.id)}
	{#if node.visible === false}
		<!-- hidden by the element's visibleWhen rule -->
	{:else if node.kind === 'section'}
		<div class="forge-inspector__section">
			<div class="forge-inspector__title">{node.title}</div>
			{#each node.children ?? [] as child (child.id)}
				{@render renderNode(child)}
			{/each}
		</div>
	{:else if node.kind === 'label'}
		<div class="forge-inspector__label">{node.text}</div>
	{:else if node.kind === 'slider'}
		<label class="forge-inspector__row">
			<span class="forge-inspector__name">{node.label}</span>
			<input
				class="forge-inspector__slider"
				type="range"
				min={meta.min ?? 0}
				max={meta.max ?? 1}
				step={meta.step ?? 0.01}
				value={Number(node.value ?? 0)}
				disabled={node.disabled === true}
				oninput={(event) => onSliderInput(node, event)}
				onchange={() => onSliderCommit(node)}
				onpointerup={() => onSliderCommit(node)}
				onkeyup={() => onSliderCommit(node)}
			/>
			<span class="forge-inspector__value">{Number(node.value ?? 0).toFixed(2)}</span>
		</label>
	{:else if node.kind === 'toggle'}
		<label class="forge-inspector__row">
			<span class="forge-inspector__name">{node.label}</span>
			<input
				type="checkbox"
				checked={node.value === true}
				disabled={node.disabled === true}
				onchange={(event) => onToggle(node, event)}
			/>
		</label>
	{:else if node.kind === 'select'}
		<label class="forge-inspector__row">
			<span class="forge-inspector__name">{node.label}</span>
			<select disabled={node.disabled === true} onchange={(event) => onSelect(node, event)}>
				{#each meta.options ?? [] as option (option)}
					<option value={option} selected={node.value === option}>{option}</option>
				{/each}
			</select>
		</label>
	{:else if node.kind === 'text'}
		<label class="forge-inspector__row">
			<span class="forge-inspector__name">{node.label}</span>
			<input class="forge-inspector__text" type="text" value={String(node.value ?? '')} disabled={node.disabled === true} onchange={(event) => onText(node, event)} />
		</label>
	{:else if node.kind === 'button'}
		<button
			type="button"
			class="forge-inspector__button"
			disabled={node.disabled === true}
			onclick={() => onButton(node)}
		>
			{node.label}{node.running === true ? ' …' : ''}
		</button>
	{/if}
{/snippet}

<style>
	.forge-inspector {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.forge-inspector__section {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-3);
		border: 1px solid var(--color-border-soft);
		background: var(--color-bg-surface);
	}
	.forge-inspector__title {
		font-size: var(--font-size-1);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-fg-muted);
	}
	.forge-inspector__label {
		color: var(--color-fg-secondary);
		font-size: var(--font-size-2);
	}
	.forge-inspector__row {
		display: grid;
		grid-template-columns: 88px 1fr 44px;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--font-size-2);
		color: var(--color-fg-secondary);
	}
	.forge-inspector__name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.forge-inspector__value {
		text-align: right;
		color: var(--color-fg-primary);
		font-variant-numeric: tabular-nums;
	}
	.forge-inspector__slider {
		width: 100%;
		accent-color: var(--color-accent);
	}
	.forge-inspector__text,
	.forge-inspector__row select {
		height: 26px;
		padding: 0 var(--space-2);
		border: 1px solid var(--color-border-soft);
		background: var(--color-bg-inset);
		color: var(--color-fg-primary);
		font-family: var(--font-family-base);
		font-size: var(--font-size-2);
	}
	.forge-inspector__button {
		height: 30px;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border-strong);
		background: var(--color-bg-elevated);
		color: var(--color-fg-primary);
		font-family: var(--font-family-base);
		font-size: var(--font-size-2);
		cursor: pointer;
	}
	.forge-inspector__button:hover:not(:disabled) {
		border-color: var(--color-border-focus);
	}
	.forge-inspector__button:disabled {
		opacity: 0.5;
		cursor: default;
	}
</style>
