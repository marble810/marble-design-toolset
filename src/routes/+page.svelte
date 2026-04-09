<script lang="ts">
	import { Dialog } from '$lib/components/ui/dialog/index.js';
	import AspectRatio from '../tools/aspect-ratio/AspectRatio.svelte';

	// Load all tool metadata statically via glob
	const metaModules = import.meta.glob('/src/tools/*/metadata.json', { eager: true }) as Record<
		string,
		{ name: string; desc: string; tag: string[]; version: string }
	>;

	interface Tool {
		id: string;
		name: string;
		desc: string;
		tag: string[];
		version: string;
	}

	const tools: Tool[] = Object.entries(metaModules).map(([path, meta]) => {
		const id = path.replace('/src/tools/', '').replace('/metadata.json', '');
		return { id, ...meta };
	});

	// Active tool state
	let activeToolId = $state<string | null>(tools[0]?.id ?? null);
	let openToolSelector = $state(false);

	let activeTool = $derived(tools.find((t) => t.id === activeToolId) ?? null);

	// Component map — add more tools here as they're created
	const componentMap: Record<string, typeof AspectRatio> = {
		'aspect-ratio': AspectRatio
	};

	let ActiveComponent = $derived(activeToolId ? componentMap[activeToolId] : null);

	function selectTool(id: string) {
		activeToolId = id;
		openToolSelector = false;
	}
</script>

<div class="flex flex-col h-screen bg-background text-foreground overflow-hidden">
	<!-- Top bar: Title + Menu -->
	<header class="flex items-center justify-between px-4 h-10 shrink-0 border-b border-border bg-card">
		<span class="text-sm font-semibold tracking-tight text-foreground/90">
			Marble Design Toolset
		</span>
		<nav class="flex items-center gap-1">
			<button
				class="px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors cursor-pointer"
			>
				File
			</button>
			<button
				class="px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors cursor-pointer"
				onclick={() => (openToolSelector = true)}
			>
				Open...
			</button>
			<button
				class="px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors cursor-pointer"
			>
				Help
			</button>
		</nav>
	</header>

	<!-- Tab strip -->
	<div class="flex items-center gap-0 px-2 h-9 shrink-0 border-b border-border bg-card/50 overflow-x-auto">
		{#each tools as tool}
			<button
				class="px-4 h-full text-xs font-medium whitespace-nowrap border-b-2 transition-colors cursor-pointer {activeToolId === tool.id
					? 'border-primary text-foreground'
					: 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50'}"
				onclick={() => (activeToolId = tool.id)}
			>
				{tool.name}
			</button>
		{/each}
	</div>

	<!-- Main content: left panel (30%) + right preview (70%) -->
	<main class="flex flex-1 overflow-hidden">
		{#if ActiveComponent}
			<ActiveComponent />
		{:else}
			<div class="flex flex-1 items-center justify-center text-muted-foreground text-sm">
				Select a tool from <button
					class="mx-1 text-primary underline cursor-pointer"
					onclick={() => (openToolSelector = true)}>Open...</button
				>
			</div>
		{/if}
	</main>
</div>

<!-- Tool Selector Dialog -->
<Dialog bind:open={openToolSelector}>
	<div class="p-5 border-b border-border flex items-center justify-between">
		<div>
			<h2 class="text-base font-semibold text-foreground">Open Tool</h2>
			<p class="text-xs text-muted-foreground mt-0.5">Select a tool to open</p>
		</div>
		<button
			aria-label="Close dialog"
			class="rounded-md p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
			onclick={() => (openToolSelector = false)}
		>
			<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>
	</div>

	<div class="overflow-y-auto p-4 flex flex-col gap-2">
		{#each tools as tool}
			<button
				class="text-left rounded-lg border px-4 py-3 transition-colors cursor-pointer {activeToolId === tool.id
					? 'border-primary bg-primary/10'
					: 'border-border bg-card hover:border-primary/50 hover:bg-accent'}"
				onclick={() => selectTool(tool.id)}
			>
				<div class="flex items-start justify-between gap-2">
					<div>
						<p class="text-sm font-medium text-foreground">{tool.name}</p>
						<p class="text-xs text-muted-foreground mt-0.5">{tool.desc}</p>
					</div>
					<span class="text-[10px] text-muted-foreground shrink-0 mt-0.5">v{tool.version}</span>
				</div>
				{#if tool.tag?.length}
					<div class="flex flex-wrap gap-1 mt-2">
						{#each tool.tag as tag}
							<span
								class="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground"
							>
								{tag}
							</span>
						{/each}
					</div>
				{/if}
			</button>
		{/each}
	</div>
</Dialog>
