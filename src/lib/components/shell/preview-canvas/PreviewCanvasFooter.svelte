<script lang="ts">
	import type {
		NormalizedPreviewCanvasFooterInfo,
		PreviewCanvasFooterInfo
	} from './footer-info.js';
	import type { PixelIconName } from '$lib/components/ui/pixel-icon/index.js';
	import { PixelIcon } from '$lib/components/ui/pixel-icon/index.js';
	import { normalizePreviewCanvasFooterInfo } from './footer-info.js';

	interface Props {
		footerInfo?: PreviewCanvasFooterInfo | null;
		anchorX: number;
		anchorY: number;
		renderScale: number;
	}

	let { footerInfo = null, anchorX, anchorY, renderScale }: Props = $props();

	let normalizedFooterInfo = $derived(
		normalizePreviewCanvasFooterInfo(footerInfo) as NormalizedPreviewCanvasFooterInfo | null
	);
</script>

{#if normalizedFooterInfo}
	<div
		class="preview-canvas-footer"
		style={`left:${anchorX}px;top:${anchorY}px;--preview-canvas-footer-scale:${renderScale};`}
	>
		<div class="preview-canvas-footer__card" style={`width:${normalizedFooterInfo.widthEm}em;`}>
			{#if normalizedFooterInfo.header}
				<div class="preview-canvas-footer__header">
					{#if normalizedFooterInfo.header.mode === 'IconOnly'}
						<PixelIcon
							name={normalizedFooterInfo.header.icon as PixelIconName}
							size={14}
							label={normalizedFooterInfo.header.iconLabel || normalizedFooterInfo.header.icon}
						/>
					{:else if normalizedFooterInfo.header.mode === 'IconAndTitle'}
						<PixelIcon
							name={normalizedFooterInfo.header.icon as PixelIconName}
							size={14}
							label={normalizedFooterInfo.header.iconLabel || normalizedFooterInfo.header.title}
						/>
						<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
						<p
							class="preview-canvas-footer__title"
							data-tooltip={normalizedFooterInfo.header.title}
							tabindex="0"
						>
							{normalizedFooterInfo.header.title}
						</p>
					{:else}
						<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
						<p
							class="preview-canvas-footer__title"
							data-tooltip={normalizedFooterInfo.header.title}
							tabindex="0"
						>
							{normalizedFooterInfo.header.title}
						</p>
					{/if}
				</div>
			{/if}

			{#each normalizedFooterInfo.lines as line}
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<p class="preview-canvas-footer__line" data-tooltip={line.text} tabindex="0">{line.text}</p>
			{/each}
		</div>
	</div>
{/if}

<style>
	.preview-canvas-footer {
		position: absolute;
		z-index: 2;
		transform: translateY(-100%) scale(var(--preview-canvas-footer-scale));
		transform-origin: left bottom;
	}

	.preview-canvas-footer__card {
		display: flex;
		flex-direction: column;
		margin-left: var(--space-2);
		user-select: none;
		-webkit-user-select: none;
	}

	.preview-canvas-footer__header {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 18px;
	}

	.preview-canvas-footer__title,
	.preview-canvas-footer__line {
		position: relative;
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		outline: none;
		cursor: default;
	}

	.preview-canvas-footer__title {
		color: var(--color-fg-primary);
		font-size: var(--font-size-1);
		font-weight: 600;
	}

	.preview-canvas-footer__line {
		font-size: var(--font-size-1);
	}

	.preview-canvas-footer__title:focus-visible,
	.preview-canvas-footer__line:focus-visible {
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.26);
	}

	.preview-canvas-footer__title[data-tooltip]:hover::after,
	.preview-canvas-footer__title[data-tooltip]:focus-visible::after,
	.preview-canvas-footer__line[data-tooltip]:hover::after,
	.preview-canvas-footer__line[data-tooltip]:focus-visible::after {
		content: attr(data-tooltip);
		position: absolute;
		right: 0;
		bottom: calc(100% + 6px);
		z-index: 2;
		max-width: 32ch;
		padding: 4px 6px;
		border: 1px solid rgba(255, 255, 255, 0.14);
		background: rgba(9, 13, 22, 0.98);
		color: var(--color-fg-primary);
		font-size: var(--font-size-1);
		line-height: 1.3;
		white-space: normal;
		word-break: break-word;
		pointer-events: none;
	}
</style>