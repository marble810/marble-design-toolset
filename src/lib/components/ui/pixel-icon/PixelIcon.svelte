<script lang="ts">
	import { icons, type PixelIconName } from './icons.js';

	interface Props {
		name: PixelIconName;
		size?: number;
		label?: string;
		class?: string;
	}

	let { name, size = 16, label = '', class: className = '' }: Props = $props();
	let svg = $derived(icons[name] ?? icons.cancel);
</script>

<span
	class={`pixel-icon${className ? ` ${className}` : ''}`}
	style={`--pixel-icon-size:${size}px;`}
	role={label ? 'img' : undefined}
	aria-label={label || undefined}
	aria-hidden={label ? undefined : true}
>
	{@html svg}
</span>

<style>
	.pixel-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--pixel-icon-size);
		height: var(--pixel-icon-size);
		flex: 0 0 auto;
		line-height: 0;
	}

	.pixel-icon :global(svg) {
		width: 100%;
		height: 100%;
		fill: currentColor;
	}
</style>