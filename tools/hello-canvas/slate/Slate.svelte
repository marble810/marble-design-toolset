<script lang="ts">
	import { onMount } from 'svelte';
	import type { ContainerSurfaceContext } from 'tool-sdk';
	import type { ParameterSetResponsePayload } from 'tool-contract';

	/**
	 * Hello Canvas — the optional Tool Slate (second container, separate realm from the
	 * Canvas). Parameter changes go through the Host Store via `parameter.set`; no
	 * Canvas ↔ Slate private bus exists in v1.
	 */
	let { context }: { context: ContainerSurfaceContext } = $props();

	let hueLabel = $state('—');
	let speedValue = $state(1);
	let revision = $state(0);
	let lastResult = $state<string>('');

	onMount(() => {
		const apply = (snapshot: { values: Record<string, unknown>; revisions: Record<string, number> }) => {
			hueLabel = String(snapshot.values.hue ?? '—');
			speedValue = Number(snapshot.values.speed ?? 1);
			revision = snapshot.revisions.speed ?? 0;
		};
		apply(context.parameters.snapshot());
		return context.parameters.subscribe(apply);
	});

	async function onSpeedInput(event: Event): Promise<void> {
		const input = event.target as HTMLInputElement;
		const value = Number(input.value);
		const result = (await context.setParameter('speed', value, revision)) as ParameterSetResponsePayload;
		lastResult = result.accepted ? `speed → ${value}` : `rejected: ${result.diagnostic.code}`;
	}
</script>

<div class="slate">
	<strong>Hello Slate</strong>
	<span>hue from Canvas realm: {hueLabel}</span>
	<label>
		speed
		<input type="range" min="0.1" max="3" step="0.1" value={speedValue} oninput={onSpeedInput} />
	</label>
	<span>{lastResult}</span>
</div>

<style>
	.slate {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px;
		height: 100%;
		box-sizing: border-box;
		font: 12px/1.5 monospace;
		color: #e8e8ef;
		background: rgba(12, 12, 16, 0.85);
	}
</style>
