<script lang="ts">
	import { onMount } from 'svelte';
	import { advancePhase, currentPhase } from '../sim/phase.ts';
	import type { ContainerSurfaceContext } from 'tool-sdk';

	/**
	 * Hello Canvas — the Visual Tool Surface. Everything here runs INSIDE the Tool
	 * Container realm: rAF loop, Canvas 2D pixels and animation state never cross the
	 * Environment API. The context prop is supplied by the container bootstrap.
	 */
	let { context }: { context: ContainerSurfaceContext } = $props();

	let canvasElement: HTMLCanvasElement | undefined = $state();
	let status = $state('booting');

	onMount(() => {
		let raf = 0;
		let running = true;
		let last = performance.now();
		let pixels: CanvasRenderingContext2D | null = null;

		const syncSurface = () => {
			const surface = context.surface();
			if (canvasElement !== undefined) {
				canvasElement.width = Math.max(1, Math.round(surface.width));
				canvasElement.height = Math.max(1, Math.round(surface.height));
			}
		};
		syncSurface();
		const detachSurface = context.onSurface(() => syncSurface());

		const draw = (now: number) => {
			if (!running) return;
			const delta = Math.min(0.05, (now - last) / 1000);
			last = now;
			const values = context.parameters.snapshot().values;
			const speed = Number(values.speed ?? 1);
			const hue = Number(values.hue ?? 210);
			const glow = Number(values.glow ?? 0.5);
			advancePhase(delta * speed);
			const t = currentPhase();

			const target = canvasElement?.getContext('2d') ?? null;
			if (target !== null) pixels = target;
			const ctx = pixels;
			if (ctx !== null && canvasElement !== undefined) {
				const { width, height } = canvasElement;
				const gradient = ctx.createLinearGradient(0, 0, width, height);
				gradient.addColorStop(0, `hsl(${hue} 80% 12%)`);
				gradient.addColorStop(1, `hsl(${(hue + 60) % 360} 80% 22%)`);
				ctx.fillStyle = gradient;
				ctx.fillRect(0, 0, width, height);
				for (let i = 0; i < 5; i++) {
					const r = (Math.min(width, height) / 3) * (0.5 + 0.25 * Math.sin(t * 2 + i)) * (0.4 + glow);
					ctx.beginPath();
					ctx.arc(
						width / 2 + Math.cos(t + i * 1.257) * width * 0.3,
						height / 2 + Math.sin(t * 1.3 + i * 2.1) * height * 0.3,
						Math.max(2, r),
						0,
						Math.PI * 2
					);
					ctx.fillStyle = `hsla(${(hue + i * 24) % 360} 90% 60% / ${0.12 + glow * 0.35})`;
					ctx.fill();
				}
				ctx.font = '12px monospace';
				ctx.fillStyle = 'rgba(255,255,255,0.75)';
				ctx.fillText(`hello-canvas · hue ${Math.round(hue)} · glow ${glow.toFixed(2)}`, 12, 20);
			}
			status = `rAF ${Math.round(now % 10000)}`;
			raf = requestAnimationFrame(draw);
		};
		raf = requestAnimationFrame(draw);

		return () => {
			running = false;
			cancelAnimationFrame(raf);
			detachSurface();
		};
	});
</script>

<canvas bind:this={canvasElement} style="width:100%;height:100%;display:block;"></canvas>
<span hidden>{status}</span>
