<script lang="ts">
	import { cn } from '$lib/utils.js';

	interface PresetRatio {
		label: string;
		w: number;
		h: number;
	}

	const PRESETS: PresetRatio[] = [
		{ label: '16:9', w: 16, h: 9 },
		{ label: '4:3', w: 4, h: 3 },
		{ label: '1:1', w: 1, h: 1 },
		{ label: '21:9', w: 21, h: 9 },
		{ label: '9:16', w: 9, h: 16 },
		{ label: '3:2', w: 3, h: 2 },
		{ label: '2:1', w: 2, h: 1 },
		{ label: '5:4', w: 5, h: 4 },
		{ label: '4:5', w: 4, h: 5 }
	];

	// Reactive state
	let ratioW = $state(16);
	let ratioH = $state(9);
	let widthPx = $state(1920);
	let heightPx = $state(1080);
	let customRatioW = $state('');
	let customRatioH = $state('');

	let activePreset = $state<string | null>('16:9');

	// Preview container reference
	let previewContainer = $state<HTMLElement | null>(null);
	let previewWidth = $state(0);
	let previewHeight = $state(0);

	function selectPreset(preset: PresetRatio) {
		ratioW = preset.w;
		ratioH = preset.h;
		activePreset = preset.label;
		customRatioW = '';
		customRatioH = '';
		// Recalculate height from current width
		heightPx = Math.round((widthPx * ratioH) / ratioW);
	}

	let widthError = $state('');
	let heightError = $state('');
	let customRatioError = $state('');

	function applyCustomRatio() {
		const w = parseFloat(customRatioW);
		const h = parseFloat(customRatioH);
		if (!customRatioW || !customRatioH || isNaN(w) || isNaN(h)) {
			customRatioError = 'Enter valid numbers for both W and H.';
			return;
		}
		if (w <= 0 || h <= 0) {
			customRatioError = 'Values must be greater than zero.';
			return;
		}
		customRatioError = '';
		ratioW = w;
		ratioH = h;
		activePreset = null;
		heightPx = Math.round((widthPx * h) / w);
	}

	function onWidthChange(e: Event) {
		const raw = (e.target as HTMLInputElement).value;
		const v = parseInt(raw);
		if (!raw || isNaN(v) || v <= 0) {
			widthError = 'Enter a positive integer.';
			return;
		}
		widthError = '';
		widthPx = v;
		heightPx = Math.round((v * ratioH) / ratioW);
	}

	function onHeightChange(e: Event) {
		const raw = (e.target as HTMLInputElement).value;
		const v = parseInt(raw);
		if (!raw || isNaN(v) || v <= 0) {
			heightError = 'Enter a positive integer.';
			return;
		}
		heightError = '';
		heightPx = v;
		widthPx = Math.round((v * ratioW) / ratioH);
	}

	// Observe preview container size
	$effect(() => {
		if (!previewContainer) return;
		const ro = new ResizeObserver((entries) => {
			for (const entry of entries) {
				previewWidth = entry.contentRect.width;
				previewHeight = entry.contentRect.height;
			}
		});
		ro.observe(previewContainer);
		return () => ro.disconnect();
	});

	// Scaled preview rectangle dimensions
	let scaledRect = $derived.by(() => {
		if (!previewWidth || !previewHeight) return { w: 0, h: 0 };
		const padding = 48;
		const availW = previewWidth - padding * 2;
		const availH = previewHeight - padding * 2;
		const aspect = widthPx / heightPx;
		let w = availW;
		let h = w / aspect;
		if (h > availH) {
			h = availH;
			w = h * aspect;
		}
		return { w: Math.round(w), h: Math.round(h) };
	});

	const PREVIEW_COLORS = [
		'#4F8EF7',
		'#7C3AED',
		'#10B981',
		'#F59E0B',
		'#EF4444',
		'#EC4899'
	];

	let colorIndex = $derived(
		PRESETS.findIndex((p) => p.label === activePreset) >= 0
			? PRESETS.findIndex((p) => p.label === activePreset) % PREVIEW_COLORS.length
			: 0
	);
</script>

<div class="flex h-full">
	<!-- Left Panel -->
	<div class="w-[300px] shrink-0 flex flex-col gap-4 p-4 border-r border-border overflow-y-auto">
		<div>
			<h3 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
				Presets
			</h3>
			<div class="grid grid-cols-3 gap-2">
				{#each PRESETS as preset}
					<button
						class={cn(
							'rounded-md border px-2 py-2 text-sm font-medium transition-colors cursor-pointer',
							activePreset === preset.label
								? 'border-primary bg-primary/10 text-primary'
								: 'border-border bg-card hover:border-primary/50 hover:bg-accent text-foreground'
						)}
						onclick={() => selectPreset(preset)}
					>
						{preset.label}
					</button>
				{/each}
			</div>
		</div>

		<div>
			<h3 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
				Custom Ratio
			</h3>
			<div class="flex items-center gap-2">
				<input
					type="number"
					min="1"
					placeholder="W"
					bind:value={customRatioW}
					class="w-full rounded-md border border-border bg-input px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
				/>
				<span class="text-muted-foreground font-bold">:</span>
				<input
					type="number"
					min="1"
					placeholder="H"
					bind:value={customRatioH}
					class="w-full rounded-md border border-border bg-input px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
				/>
				<button
					onclick={applyCustomRatio}
					class="shrink-0 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90 transition-colors cursor-pointer"
				>
					Apply
				</button>
			</div>
			{#if customRatioError}
				<p class="mt-1 text-xs text-red-400">{customRatioError}</p>
			{:else}
				<p class="mt-1.5 text-xs text-muted-foreground">
					Current: {ratioW}:{ratioH}
				</p>
			{/if}
		</div>

		<div>
			<h3 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
				Dimensions
			</h3>
			<div class="flex flex-col gap-3">
				<div>
					<label class="block text-xs text-muted-foreground mb-1" for="width-input">
						Width (px)
					</label>
					<input
						id="width-input"
						type="number"
						min="1"
						value={widthPx}
						onchange={onWidthChange}
						class="w-full rounded-md border {widthError ? 'border-red-500' : 'border-border'} bg-input px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					/>
					{#if widthError}
						<p class="mt-1 text-xs text-red-400">{widthError}</p>
					{/if}
				</div>
				<div>
					<label class="block text-xs text-muted-foreground mb-1" for="height-input">
						Height (px)
					</label>
					<input
						id="height-input"
						type="number"
						min="1"
						value={heightPx}
						onchange={onHeightChange}
						class="w-full rounded-md border {heightError ? 'border-red-500' : 'border-border'} bg-input px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					/>
					{#if heightError}
						<p class="mt-1 text-xs text-red-400">{heightError}</p>
					{/if}
				</div>
			</div>
		</div>

		<div class="rounded-md border border-border bg-card/50 p-3">
			<p class="text-xs text-muted-foreground mb-1">Ratio</p>
			<p class="text-lg font-semibold text-foreground">{ratioW}:{ratioH}</p>
			<p class="text-xs text-muted-foreground mt-1">
				{widthPx} × {heightPx} px
			</p>
			<p class="text-xs text-muted-foreground">
				{(widthPx / heightPx).toFixed(4)} : 1
			</p>
		</div>
	</div>

	<!-- Right Preview -->
	<div
		class="flex-1 flex items-center justify-center bg-muted/20 relative overflow-hidden"
		bind:this={previewContainer}
	>
		<!-- Checker background pattern -->
		<div
			class="absolute inset-0"
			style="background-image: repeating-conic-gradient(#1a1f2e 0% 25%, #141824 0% 50%); background-size: 24px 24px;"
		></div>

		{#if scaledRect.w > 0 && scaledRect.h > 0}
			<div class="relative z-10 flex flex-col items-center gap-3">
				<div
					class="rounded shadow-2xl flex items-center justify-center relative"
					style="width: {scaledRect.w}px; height: {scaledRect.h}px; background-color: {PREVIEW_COLORS[colorIndex]}22; border: 2px solid {PREVIEW_COLORS[colorIndex]};"
				>
					<span class="text-white/60 text-xs font-mono select-none">
						{ratioW}:{ratioH}
					</span>
				</div>
				<div class="bg-card/90 backdrop-blur-sm border border-border rounded-md px-4 py-2 text-center">
					<p class="text-sm font-semibold text-foreground">{widthPx} × {heightPx} px</p>
					<p class="text-xs text-muted-foreground mt-0.5">
						Preview: {scaledRect.w} × {scaledRect.h} px
					</p>
				</div>
			</div>
		{/if}
	</div>
</div>
