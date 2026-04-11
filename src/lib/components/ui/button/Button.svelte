<script lang="ts">
	import { Button as BitsButton } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Variant = 'solid' | 'outline' | 'ghost' | 'danger';
	type Size = 'sm' | 'md' | 'icon';

	interface Props extends HTMLButtonAttributes {
		variant?: Variant;
		size?: Size;
		class?: string;
		children?: Snippet;
	}

	let {
		variant = 'solid',
		size = 'md',
		type = 'button',
		class: className = '',
		children,
		...rest
	}: Props = $props();

	let buttonClass = $derived(`button button--${variant} button--${size}${className ? ` ${className}` : ''}`);
</script>

<BitsButton.Root class={buttonClass} {type} {...rest}>
	{@render children?.()}
</BitsButton.Root>

<style>
	:global(.button) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		min-width: 0;
		padding: 0 var(--space-3);
		border: var(--border-width-inner) solid var(--color-border-soft);
		background: var(--color-bg-elevated);
		color: var(--color-fg-primary);
		font-size: var(--font-size-2);
		line-height: 1;
		cursor: pointer;
		transition:
			transform var(--duration-fast) var(--easing-standard),
			background var(--duration-fast) var(--easing-standard),
			border-color var(--duration-fast) var(--easing-standard),
			color var(--duration-fast) var(--easing-standard);
	}

	:global(.button:hover) {
		background: #26324c;
		border-color: var(--color-border-strong);
	}

	:global(.button:active) {
		transform: translateY(1px);
	}

	:global(.button:disabled) {
		opacity: 0.45;
		cursor: not-allowed;
	}

	:global(.button--sm) {
		height: 28px;
		padding-inline: var(--space-3);
		font-size: var(--font-size-1);
	}

	:global(.button--md) {
		height: 34px;
		padding-inline: var(--space-4);
	}

	:global(.button--icon) {
		width: 30px;
		height: 30px;
		padding: 0;
	}

	:global(.button--solid) {
		background: #2f275a;
		border-color: #6d5ed2;
		color: #f4f0ff;
	}

	:global(.button--solid:hover) {
		background: #3a2f74;
		border-color: #8f7ff0;
	}

	:global(.button--outline) {
		background: transparent;
		color: var(--color-fg-secondary);
	}

	:global(.button--outline:hover) {
		color: var(--color-fg-primary);
	}

	:global(.button--ghost) {
		background: transparent;
		border-color: transparent;
		color: var(--color-fg-secondary);
	}

	:global(.button--ghost:hover) {
		background: rgba(149, 128, 255, 0.14);
		border-color: rgba(149, 128, 255, 0.36);
		color: var(--color-fg-primary);
	}

	:global(.button--danger) {
		background: rgba(255, 111, 125, 0.12);
		border-color: rgba(255, 111, 125, 0.48);
		color: #ffd9de;
	}

	:global(.button--danger:hover) {
		background: rgba(255, 111, 125, 0.2);
		border-color: rgba(255, 111, 125, 0.7);
	}
</style>
