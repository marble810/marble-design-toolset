<script lang="ts">
	import arrowRight from 'pixelarticons/svg/arrow-right.svg?raw';
	import aspectRatio from 'pixelarticons/svg/aspect-ratio.svg?raw';
	import cancel from 'pixelarticons/svg/cancel.svg?raw';
	import check from 'pixelarticons/svg/check.svg?raw';
	import chevronDown from 'pixelarticons/svg/chevron-down.svg?raw';
	import chevronUp from 'pixelarticons/svg/chevron-up.svg?raw';
	import frame from 'pixelarticons/svg/frame.svg?raw';
	import infoBox from 'pixelarticons/svg/info-box.svg?raw';
	import moreHorizontal from 'pixelarticons/svg/more-horizontal.svg?raw';
	import openIcon from 'pixelarticons/svg/open.svg?raw';
	import section from 'pixelarticons/svg/section.svg?raw';
	import settings2 from 'pixelarticons/svg/settings-2.svg?raw';
	import sparkles from 'pixelarticons/svg/sparkles.svg?raw';
	import zoomIn from 'pixelarticons/svg/zoom-in.svg?raw';
	import zoomOut from 'pixelarticons/svg/zoom-out.svg?raw';

	const icons = {
		'arrow-right': arrowRight,
		'aspect-ratio': aspectRatio,
		cancel,
		check,
		'chevron-down': chevronDown,
		'chevron-up': chevronUp,
		frame,
		'info-box': infoBox,
		'more-horizontal': moreHorizontal,
		open: openIcon,
		section,
		'settings-2': settings2,
		sparkles,
		'zoom-in': zoomIn,
		'zoom-out': zoomOut
	} as const;

	export type PixelIconName = keyof typeof icons;

	interface Props {
		name: PixelIconName;
		size?: number;
		label?: string;
		class?: string;
	}

	let { name, size = 16, label = '', class: className = '' }: Props = $props();
	let svg = $derived(icons[name] ?? cancel);
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