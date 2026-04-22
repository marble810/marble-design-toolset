<script lang="ts">
	import type { Component } from 'svelte';
	import { Dialog } from '$lib/components/ui/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { ToolShell } from '../tool-shell/index.js';
	import { loadTechStacks } from '$lib/runtime/tech-stack';
	import { loadToolDefinition } from '$lib/runtime/tool-registry';
	import { setToolSessionContext } from '$lib/runtime/tool-session-context';
	import { setToolShellContext, type ToolShellContextValue } from '$lib/runtime/tool-shell-context';
	import type { ToolDefinition } from '$lib/types/tool';

	const EMPTY_TOOL_METADATA = {
		name: '',
		desc: '',
		tag: [],
		version: ''
	};

	interface Props {
		toolId: string;
		isActive?: boolean;
		leftPanelWidthVw?: number;
	}

	let { toolId, isActive = false, leftPanelWidthVw = 28 }: Props = $props();

	let aboutDialogOpen = $state(false);
	let isLoading = $state(false);
	let loadError = $state('');
	let definition = $state<ToolDefinition | null>(null);
	let SessionComponent = $state<Component<any> | null>(null);
	let reloadToken = $state(0);
	let loadVersion = 0;

	const toolSessionContext = {
		isActive: () => isActive
	};

	const toolShellContext = $state<ToolShellContextValue>({
		metadata: EMPTY_TOOL_METADATA,
		menuActions: [],
		openAbout: () => {
			aboutDialogOpen = true;
		},
		onMenuAction: () => {}
	});

	setToolSessionContext(toolSessionContext);
	setToolShellContext(toolShellContext);

	function retryLoad() {
		reloadToken += 1;
	}

	$effect(() => {
		if (!isActive && aboutDialogOpen) {
			aboutDialogOpen = false;
		}
	});

	$effect(() => {
		const nextDefinition = definition;
		toolShellContext.metadata = nextDefinition?.metadata ?? EMPTY_TOOL_METADATA;
		toolShellContext.menuActions = nextDefinition?.menuActions ?? [];
		toolShellContext.openAbout = () => {
			aboutDialogOpen = true;
		};
		toolShellContext.onMenuAction = () => {};
	});

	$effect(() => {
		toolId;
		reloadToken;

		let disposed = false;
		const currentLoad = ++loadVersion;

		loadError = '';
		isLoading = true;
		definition = null;
		SessionComponent = null;

		void (async () => {
			try {
				const nextDefinition = await loadToolDefinition(toolId);
				await loadTechStacks(nextDefinition.techStack);
				const componentModule = await nextDefinition.loadComponent();

				if (disposed || currentLoad !== loadVersion) {
					return;
				}

				definition = nextDefinition;
				SessionComponent = componentModule.default;
			} catch (error) {
				if (disposed || currentLoad !== loadVersion) {
					return;
				}

				loadError = error instanceof Error ? error.message : 'Failed to load the selected tool.';
			} finally {
				if (!disposed && currentLoad === loadVersion) {
					isLoading = false;
				}
			}
		})();

		return () => {
			disposed = true;
		};
	});
</script>

<div class="tool-session" class:tool-session--hidden={!isActive}>
	{#if isLoading}
		<div class="tool-session__status">
			<p class="tool-session__status-title">Loading tool...</p>
			<p class="tool-session__status-copy">Preparing runtime definition and declared tech stack.</p>
		</div>
	{:else if loadError}
		<div class="tool-session__status">
			<p class="tool-session__status-title">Tool failed to load</p>
			<p class="tool-session__status-copy">{loadError}</p>
			<Button variant="outline" size="sm" onclick={retryLoad}>Retry</Button>
		</div>
	{:else if SessionComponent}
		<ToolShell {leftPanelWidthVw}>
			<SessionComponent />
		</ToolShell>
	{/if}
</div>

<Dialog
	bind:open={aboutDialogOpen}
	title={definition?.metadata.name ?? 'About'}
	description="Metadata supplied by the active tool definition."
	width="sm"
>
	{#if definition}
		<div class="about-panel">
			<div class="about-panel__row">
				<span class="about-panel__label">Version</span>
				<strong>{definition.metadata.version}</strong>
			</div>
			<div class="about-panel__row about-panel__row--stacked">
				<span class="about-panel__label">Description</span>
				<p>{definition.metadata.desc}</p>
			</div>
			<div class="about-panel__row about-panel__row--stacked">
				<span class="about-panel__label">Tags</span>
				<div class="about-panel__tags">
					{#each definition.metadata.tag as tag}
						<span class="pixel-chip">{tag}</span>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</Dialog>

<style>
	.tool-session {
		height: 100%;
		min-height: 0;
	}

	.tool-session--hidden {
		display: none;
	}

	.tool-session__status {
		display: grid;
		place-items: center;
		height: 100%;
		padding: var(--space-7);
		gap: var(--space-3);
		text-align: center;
	}

	.tool-session__status-title {
		margin: 0;
		font-size: 24px;
		line-height: 1.1;
	}

	.tool-session__status-copy,
	.about-panel p {
		margin: 0;
		max-width: 520px;
		color: var(--color-fg-secondary);
		font-size: var(--font-size-3);
	}

	.about-panel {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

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

	.about-panel__label {
		color: var(--color-fg-secondary);
		font-size: var(--font-size-1);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.about-panel__tags {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
</style>