<script lang="ts">
	interface Props {
		ratioLabel: string;
		widthPx: number;
		heightPx: number;
	}

	let { ratioLabel, widthPx, heightPx }: Props = $props();
</script>

<div class="aspect-ratio-preview">
	<div class="aspect-ratio-preview__grid"></div>
	<div class="aspect-ratio-preview__inner">
		<div class="aspect-ratio-preview__pill">Canvas</div>
		<div class="aspect-ratio-preview__ratio">{ratioLabel}</div>
		<div class="aspect-ratio-preview__size">{widthPx} × {heightPx} px</div>
	</div>
</div>

<style>
	.aspect-ratio-preview {
		position: relative;
		width: 100%;
		height: 100%;
		border: 2px solid rgba(149, 128, 255, 0.7);
		background: rgba(149, 128, 255, 0.12);
		box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.04);
		overflow: hidden;
	}

	.aspect-ratio-preview__grid {
		position: absolute;
		inset: 0;
		border: 1px dashed rgba(255, 255, 255, 0.08);
		margin: 24px;
		opacity: 0.8;
	}

	.aspect-ratio-preview__inner {
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		width: 100%;
		height: 100%;
		padding: 24px;
		gap: var(--space-2);
	}

	.aspect-ratio-preview__pill {
		display: inline-flex;
		align-self: flex-start;
		padding: 0 var(--space-2);
		height: 20px;
		align-items: center;
		background: rgba(9, 13, 22, 0.68);
		border: 1px solid rgba(255, 255, 255, 0.1);
		color: var(--color-fg-secondary);
		font-size: var(--font-size-1);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.aspect-ratio-preview__ratio {
		font-size: clamp(20px, 4vw, 52px);
		font-weight: 700;
		line-height: 1;
		letter-spacing: 0.03em;
		color: #ffffff;
	}

	.aspect-ratio-preview__size {
		color: rgba(255, 255, 255, 0.82);
		font-size: var(--font-size-3);
	}
</style>