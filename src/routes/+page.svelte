<script lang="ts">
	import { browser } from '$app/environment';
	import type { Component } from 'svelte';
	import { ToolShell } from '$lib/components/shell/index.js';
	import { Button, Dialog, PixelIcon, Tabs } from '$lib/components/ui/index.js';
	import type { TabItem } from '$lib/components/ui/tabs/index.js';
	import { setToolShellContext, type ToolShellContextValue } from '$lib/runtime/tool-shell-context';
	import { loadTechStacks } from '$lib/runtime/tech-stack';
	import { getToolCatalog, isValidToolId, loadToolDefinition } from '$lib/runtime/tool-registry';
	import {
		DEFAULT_LEFT_PANEL_WIDTH_VW,
		MAX_LEFT_PANEL_WIDTH_VW,
		MIN_LEFT_PANEL_WIDTH_VW,
		clampLeftPanelWidthVw,
		persistWorkspaceState,
		readHashToolId,
		resolveInitialWorkspaceState,
		writeHashToolId
	} from '$lib/runtime/workspace-state';
	import type { ToolDefinition } from '$lib/types/tool';

	const toolCatalog = getToolCatalog();
	const validToolIds = toolCatalog.map((tool) => tool.id);
	const EMPTY_TOOL_METADATA = {
		name: '',
		desc: '',
		tag: [],
		version: ''
	};

	let openDialogOpen = $state(false);
	let helpDialogOpen = $state(false);
	let settingsDialogOpen = $state(false);
	let aboutDialogOpen = $state(false);
	let openToolIds = $state<string[]>([]);
	let activeToolId = $state('');
	let leftPanelWidthVw = $state(DEFAULT_LEFT_PANEL_WIDTH_VW);
	let isHydrated = $state(false);
	let isLoading = $state(false);
	let loadError = $state('');
	let activeDefinition = $state<ToolDefinition | null>(null);
	let ActiveComponent = $state<Component<any> | null>(null);
	let toolLoadVersion = 0;

	const toolShellContext = $state<ToolShellContextValue>({
		metadata: EMPTY_TOOL_METADATA,
		menuActions: [],
		openAbout: () => {
			aboutDialogOpen = true;
		},
		onMenuAction: () => {}
	});

	setToolShellContext(toolShellContext);

	let openTabs = $derived.by<TabItem[]>(() =>
		openToolIds.flatMap((toolId) => {
			const tool = toolCatalog.find((entry) => entry.id === toolId);
			return tool ? [{ id: tool.id, label: tool.name, closable: true }] : [];
		})
	);

	function activateTool(toolId: string) {
		if (!isValidToolId(toolId)) {
			return;
		}

		activeToolId = toolId;
		if (!openToolIds.includes(toolId)) {
			openToolIds = [...openToolIds, toolId];
		}
	}

	function openTool(toolId: string) {
		activateTool(toolId);
		openDialogOpen = false;
	}

	function closeTool(toolId: string) {
		const previousToolIds = [...openToolIds];
		const targetIndex = previousToolIds.indexOf(toolId);

		if (targetIndex === -1) {
			return;
		}

		const remainingToolIds = previousToolIds.filter((id) => id !== toolId);
		openToolIds = remainingToolIds;

		if (activeToolId === toolId) {
			activeToolId = remainingToolIds[targetIndex] ?? remainingToolIds[targetIndex - 1] ?? '';
		}
	}

	function updateLeftPanelWidth(event: Event) {
		const value = Number((event.currentTarget as HTMLInputElement).value);
		leftPanelWidthVw = clampLeftPanelWidthVw(value);
	}

	$effect(() => {
		if (!browser || isHydrated) {
			return;
		}

		const initialState = resolveInitialWorkspaceState(validToolIds);
		openToolIds = initialState.openToolIds;
		activeToolId = initialState.activeToolId ?? '';
		leftPanelWidthVw = initialState.leftPanelWidthVw;
		isHydrated = true;
	});

	$effect(() => {
		if (!browser || !isHydrated) {
			return;
		}

		persistWorkspaceState({
			openToolIds,
			activeToolId: activeToolId || null,
			leftPanelWidthVw
		});
		writeHashToolId(activeToolId || null);
	});

	$effect(() => {
		if (!browser || !isHydrated) {
			return;
		}

		const handleHashChange = () => {
			const hashToolId = readHashToolId();
			if (hashToolId && isValidToolId(hashToolId)) {
				activateTool(hashToolId);
			}
		};

		window.addEventListener('hashchange', handleHashChange);
		return () => window.removeEventListener('hashchange', handleHashChange);
	});

	$effect(() => {
		const definition = activeDefinition;
		toolShellContext.metadata = definition?.metadata ?? EMPTY_TOOL_METADATA;
		toolShellContext.menuActions = definition?.menuActions ?? [];
		toolShellContext.openAbout = () => {
			aboutDialogOpen = true;
		};
		toolShellContext.onMenuAction = () => {};
	});

	$effect(() => {
		const nextToolId = activeToolId;
		loadError = '';

		if (!nextToolId) {
			activeDefinition = null;
			ActiveComponent = null;
			isLoading = false;
			return;
		}

		const currentLoad = ++toolLoadVersion;
		isLoading = true;
		activeDefinition = null;
		ActiveComponent = null;

		void (async () => {
			try {
				const definition = await loadToolDefinition(nextToolId);
				await loadTechStacks(definition.techStack);
				const componentModule = await definition.loadComponent();

				if (currentLoad !== toolLoadVersion) {
					return;
				}

				activeDefinition = definition;
				ActiveComponent = componentModule.default;
			} catch (error) {
				if (currentLoad !== toolLoadVersion) {
					return;
				}

				loadError = error instanceof Error ? error.message : 'Failed to load the selected tool.';
			} finally {
				if (currentLoad === toolLoadVersion) {
					isLoading = false;
				}
			}
		})();
	});
</script>

<div class="workspace">
	<header class="workspace__header">
		<div class="workspace__brand">
			<div class="workspace__brand-copy">
				<strong class="workspace__title">Marble Design Toolset</strong>
			</div>
		</div>

		<nav class="workspace__actions">
			<Button variant="ghost" size="sm" onclick={() => (openDialogOpen = true)}>
				<PixelIcon name="open" size={14} />
				<span>Open</span>
			</Button>
			<Button variant="ghost" size="sm" onclick={() => (helpDialogOpen = true)}>
				<PixelIcon name="sparkles" size={14} />
				<span>Help</span>
			</Button>
			<a class="button button--ghost button--sm" href="/docs" target="_blank" rel="noreferrer noopener">
				<PixelIcon name="info-box" size={14} />
				<span>Docs</span>
			</a>
			<Button variant="ghost" size="sm" onclick={() => (settingsDialogOpen = true)}>
				<PixelIcon name="settings-2" size={14} />
				<span>Settings</span>
			</Button>
		</nav>
	</header>

	<section class="workspace__tabs">
		{#if openTabs.length > 0}
			<Tabs items={openTabs} bind:value={activeToolId} onClose={closeTool} />
		{:else}
			<div class="workspace__tabs-empty">No tools open</div>
		{/if}
	</section>

	<main class="workspace__content">
		{#if isLoading}
			<div class="workspace__status">
				<p class="workspace__status-title">Loading tool...</p>
				<p class="workspace__status-copy">Preparing runtime definition and declared tech stack.</p>
			</div>
		{:else if loadError}
			<div class="workspace__status">
				<p class="workspace__status-title">Tool failed to load</p>
				<p class="workspace__status-copy">{loadError}</p>
				<Button variant="outline" size="sm" onclick={() => activeToolId && activateTool(activeToolId)}>
					Retry
				</Button>
			</div>
		{:else if ActiveComponent}
			<ToolShell {leftPanelWidthVw}>
				<ActiveComponent />
			</ToolShell>
		{:else}
			<div class="workspace__empty-state">
				<div class="workspace__empty-icon">
					<PixelIcon name="section" size={22} />
				</div>
				<h2 class="workspace__empty-title">Open a tool to start</h2>
				<p class="workspace__empty-copy">
					This workspace now runs on the new shell, runtime, and pixel UI foundation.
				</p>
				<Button variant="solid" size="md" onclick={() => (openDialogOpen = true)}>
					<PixelIcon name="open" size={14} />
					<span>Browse Tools</span>
				</Button>
			</div>
		{/if}
	</main>
</div>

<Dialog
	bind:open={openDialogOpen}
	title="Open Tool"
	description="Choose a tool to mount inside the shared workspace shell."
	width="lg"
>
	<div class="tool-catalog pixel-scrollbar">
		{#each toolCatalog as tool}
			<button type="button" class="tool-card" onclick={() => openTool(tool.id)}>
				<div class="tool-card__header">
					<div>
						<h3 class="tool-card__title">{tool.name}</h3>
						<p class="tool-card__description">{tool.desc}</p>
					</div>
					<span class="tool-card__version">v{tool.version}</span>
				</div>

				<div class="tool-card__footer">
					<div class="tool-card__tags">
						{#each tool.tag as tag}
							<span class="pixel-chip">{tag}</span>
						{/each}
					</div>
					<span class="tool-card__cta">
						Open
						<PixelIcon name="arrow-right" size={12} />
					</span>
				</div>
			</button>
		{/each}
	</div>
</Dialog>

<Dialog bind:open={helpDialogOpen} title="Help" description="Current workspace behavior and constraints." width="md">
	<div class="dialog-copy">
		<p>The workspace uses a framework-owned shell with hash-based tool routing and local tab persistence.</p>
		<p>Tools only render left panel controls and right panel preview content. The shell owns tabs, dialogs, settings, and preview navigation.</p>
		<p>The UI is currently English-only and requires a minimum width of 720px.</p>
	</div>
</Dialog>

<Dialog
	bind:open={settingsDialogOpen}
	title="Settings"
	description="Workspace-wide preferences stored in local persistence."
	width="sm"
>
	<div class="settings-panel">
		<div class="settings-panel__row">
			<div>
				<label class="settings-panel__label" for="left-panel-width-range">Left Panel Width</label>
				<p class="settings-panel__hint">Stored as a viewport width value.</p>
			</div>
			<span class="settings-panel__value">{leftPanelWidthVw}vw</span>
		</div>

		<input
			id="left-panel-width-range"
			type="range"
			min={MIN_LEFT_PANEL_WIDTH_VW}
			max={MAX_LEFT_PANEL_WIDTH_VW}
			step="1"
			value={leftPanelWidthVw}
			oninput={updateLeftPanelWidth}
			class="settings-panel__range"
		/>

		<input
			type="number"
			min={MIN_LEFT_PANEL_WIDTH_VW}
			max={MAX_LEFT_PANEL_WIDTH_VW}
			value={leftPanelWidthVw}
			onchange={updateLeftPanelWidth}
			class="pixel-input"
		/>
	</div>
</Dialog>

<Dialog
	bind:open={aboutDialogOpen}
	title={activeDefinition?.metadata.name ?? 'About'}
	description="Metadata supplied by the active tool definition."
	width="sm"
>
	{#if activeDefinition}
		<div class="about-panel">
			<div class="about-panel__row">
				<span class="about-panel__label">Version</span>
				<strong>{activeDefinition.metadata.version}</strong>
			</div>
			<div class="about-panel__row about-panel__row--stacked">
				<span class="about-panel__label">Description</span>
				<p>{activeDefinition.metadata.desc}</p>
			</div>
			<div class="about-panel__row about-panel__row--stacked">
				<span class="about-panel__label">Tags</span>
				<div class="about-panel__tags">
					{#each activeDefinition.metadata.tag as tag}
						<span class="pixel-chip">{tag}</span>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</Dialog>

<style>
	.workspace {
		display: grid;
		grid-template-rows: auto auto minmax(0, 1fr);
		height: 100%;
		padding: 0;
		gap: 0;
	}

	.workspace__header,
	.workspace__tabs,
	.workspace__content {
		background: var(--color-bg-panel);
		outline: 1px solid var(--color-border-soft);
		outline-offset: -1px;
	}

	.workspace__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		padding: var(--space-2) var(--space-4);
	}

	.workspace__brand {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		min-width: 0;
	}

	.workspace__brand-copy {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}

	.workspace__title {
		font-size: var(--font-size-3);
		line-height: var(--line-height-tight);
	}

	.workspace__actions {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

	.workspace__tabs {
		display: flex;
		align-items: center;
		min-height: 36px;
		padding: var(--space-1) var(--space-3);
		overflow: hidden;
	}

	.workspace__tabs-empty {
		color: var(--color-fg-muted);
		font-size: var(--font-size-2);
	}

	.workspace__content {
		min-height: 0;
		padding: var(--space-3);
	}

	.workspace__status,
	.workspace__empty-state {
		display: grid;
		place-items: center;
		height: 100%;
		padding: var(--space-7);
		text-align: center;
	}

	.workspace__status {
		gap: var(--space-3);
	}

	.workspace__status-title,
	.workspace__empty-title {
		margin: 0;
		font-size: 24px;
		line-height: 1.1;
	}

	.workspace__status-copy,
	.workspace__empty-copy {
		margin: 0;
		max-width: 520px;
		color: var(--color-fg-secondary);
		font-size: var(--font-size-3);
	}

	.workspace__empty-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 52px;
		height: 52px;
		margin-bottom: var(--space-4);
		border: 1px solid rgba(149, 128, 255, 0.36);
		background: transparent;
		color: var(--color-accent-soft);
	}

	.tool-catalog {
		display: grid;
		gap: var(--space-3);
		max-height: 58vh;
		overflow: auto;
	}

	.tool-card {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		width: 100%;
		padding: var(--space-4);
		border: var(--border-width-inner) solid var(--color-border-soft);
		background: rgba(255, 255, 255, 0.02);
		color: var(--color-fg-primary);
		text-align: left;
		cursor: pointer;
		transition:
			border-color var(--duration-fast) var(--easing-standard),
			transform var(--duration-fast) var(--easing-standard),
			background var(--duration-fast) var(--easing-standard);
	}

	.tool-card:hover {
		transform: translateY(-1px);
		border-color: rgba(149, 128, 255, 0.46);
		background: rgba(149, 128, 255, 0.08);
	}

	.tool-card__header,
	.tool-card__footer {
		display: flex;
		justify-content: space-between;
		gap: var(--space-4);
	}

	.tool-card__title {
		margin: 0 0 var(--space-2);
		font-size: var(--font-size-3);
	}

	.tool-card__description {
		margin: 0;
		color: var(--color-fg-secondary);
	}

	.tool-card__version {
		color: var(--color-fg-muted);
		font-size: var(--font-size-1);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.tool-card__tags {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.tool-card__cta {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--color-accent-soft);
		font-size: var(--font-size-2);
	}

	.dialog-copy,
	.about-panel,
	.settings-panel {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.dialog-copy p,
	.about-panel p,
	.settings-panel p {
		margin: 0;
		color: var(--color-fg-secondary);
	}

	.settings-panel__row,
	.about-panel__row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
	}

	.about-panel__row--stacked {
		flex-direction: column;
		align-items: flex-start;
	}

	.settings-panel__label,
	.about-panel__label {
		color: var(--color-fg-secondary);
		font-size: var(--font-size-1);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.settings-panel__hint {
		margin-top: var(--space-1);
	}

	.settings-panel__value {
		color: var(--color-fg-primary);
		font-size: var(--font-size-3);
	}

	.settings-panel__range {
		width: 100%;
	}

	.about-panel__tags {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
</style>
