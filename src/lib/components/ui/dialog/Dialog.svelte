<script lang="ts">
	import { Dialog as BitsDialog } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import { PixelIcon } from '../pixel-icon/index.js';

	interface Props {
		open?: boolean;
		title?: string;
		description?: string;
		footer?: Snippet;
		width?: 'sm' | 'md' | 'lg' | 'xl';
		class?: string;
		children?: Snippet;
	}

	let {
		open = $bindable(false),
		title = '',
		description = '',
		footer,
		width = 'md',
		class: className = '',
		children
	}: Props = $props();

	let contentClass = $derived(`dialog__content pixel-frame dialog__content--${width}${className ? ` ${className}` : ''}`);

	function closeDialog() {
		open = false;
	}
</script>

<BitsDialog.Root bind:open>
	<BitsDialog.Portal>
		<BitsDialog.Overlay forceMount>
			{#snippet child({ props, open: isOpen })}
				{#if isOpen}
					<div {...props} class="dialog__overlay"></div>
				{/if}
			{/snippet}
		</BitsDialog.Overlay>

		<BitsDialog.Content forceMount>
			{#snippet child({ props, open: isOpen })}
				{#if isOpen}
					<div {...props} class={contentClass}>
						<div class="dialog__header">
							<div class="dialog__heading">
								{#if title}
									<BitsDialog.Title class="dialog__title">{title}</BitsDialog.Title>
								{/if}
								{#if description}
									<BitsDialog.Description class="dialog__description">
										{description}
									</BitsDialog.Description>
								{/if}
							</div>

							<BitsDialog.Close>
								{#snippet child({ props: closeProps })}
									<button
										{...closeProps}
										type="button"
										class="dialog__close"
										aria-label="Close dialog"
										onclick={closeDialog}
									>
										<PixelIcon name="cancel" size={14} />
									</button>
								{/snippet}
							</BitsDialog.Close>
						</div>

						<div class="dialog__body pixel-scrollbar">
							{@render children?.()}
						</div>

						{#if footer}
							<div class="dialog__footer">{@render footer()}</div>
						{/if}
					</div>
				{/if}
			{/snippet}
		</BitsDialog.Content>
	</BitsDialog.Portal>
</BitsDialog.Root>

<style>
	.dialog__overlay {
		position: fixed;
		inset: 0;
		z-index: 70;
		background: rgba(2, 4, 10, 0.72);
		backdrop-filter: blur(8px);
	}

	.dialog__content {
		position: fixed;
		left: 50%;
		top: 50%;
		z-index: 80;
		display: flex;
		flex-direction: column;
		width: min(calc(100vw - 48px), 780px);
		max-height: min(82vh, 760px);
		min-height: 0;
		transform: translate(-50%, -50%);
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
		background: var(--color-bg-surface);
	}

	.dialog__content--sm {
		width: min(calc(100vw - 48px), 420px);
	}

	.dialog__content--md {
		width: min(calc(100vw - 48px), 620px);
	}

	.dialog__content--lg {
		width: min(calc(100vw - 48px), 760px);
	}

	.dialog__content--xl {
		width: min(calc(100vw - 48px), 920px);
	}

	.dialog__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-4);
		padding: var(--space-5);
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	.dialog__heading {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}

	.dialog__title {
		font-size: var(--font-size-4);
		font-weight: 700;
		line-height: var(--line-height-tight);
	}

	.dialog__description {
		color: var(--color-fg-muted);
		font-size: var(--font-size-2);
	}

	.dialog__close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: 1px solid transparent;
		color: var(--color-fg-muted);
		cursor: pointer;
		transition:
			background var(--duration-fast) var(--easing-standard),
			border-color var(--duration-fast) var(--easing-standard),
			color var(--duration-fast) var(--easing-standard);
	}

	.dialog__close:hover {
		background: rgba(149, 128, 255, 0.14);
		border-color: rgba(149, 128, 255, 0.3);
		color: var(--color-fg-primary);
	}

	.dialog__body {
		overflow: auto;
		padding: var(--space-5);
	}

	.dialog__footer {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-3);
		padding: var(--space-4) var(--space-5) var(--space-5);
		border-top: 1px solid rgba(255, 255, 255, 0.06);
	}
</style>
