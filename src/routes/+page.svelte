<script lang="ts">
	import { browser } from '$app/environment';
	import ToolSession from '$lib/components/shell/tool-session/ToolSession.svelte';
	import {
		OpenToolDialog,
		WorkspaceEmptyState,
		WorkspaceHeader,
		WorkspaceHelpDialog,
		WorkspaceSettingsDialog,
		WorkspaceTabs
	} from '$lib/components/workspace/index.js';
	import { createWorkspaceController } from '$lib/runtime/workspace-controller/index.js';

	const workspace = createWorkspaceController({ browser });

	let openToolsDialogOpen = $state(false);
	let helpDialogOpen = $state(false);
	let settingsDialogOpen = $state(false);

	function handleOpenTool(toolId: string): void {
		workspace.openTool(toolId);
		openToolsDialogOpen = false;
	}
</script>

<div class="workspace">
	<WorkspaceHeader
		onOpenTools={() => (openToolsDialogOpen = true)}
		onOpenHelp={() => (helpDialogOpen = true)}
		onOpenSettings={() => (settingsDialogOpen = true)}
	/>

	<WorkspaceTabs
		items={workspace.openTabs}
		activeToolId={workspace.activeToolId}
		onActivate={workspace.activateTool}
		onClose={workspace.closeTool}
	/>

	<main class="workspace__content">
		{#if workspace.openToolIds.length > 0}
			<div class="workspace__session-stack">
				{#each workspace.openToolIds as toolId (toolId)}
					<ToolSession
						toolId={toolId}
						isActive={workspace.activeToolId === toolId}
						leftPanelWidthVw={workspace.leftPanelWidthVw}
					/>
				{/each}
			</div>
		{:else}
			<WorkspaceEmptyState onOpenTools={() => (openToolsDialogOpen = true)} />
		{/if}
	</main>
</div>

<OpenToolDialog
	bind:open={openToolsDialogOpen}
	toolCatalog={workspace.toolCatalog}
	onOpenTool={handleOpenTool}
/>
<WorkspaceHelpDialog bind:open={helpDialogOpen} />
<WorkspaceSettingsDialog
	bind:open={settingsDialogOpen}
	leftPanelWidthVw={workspace.leftPanelWidthVw}
	onChangeLeftPanelWidth={workspace.setLeftPanelWidth}
/>
<style>
	.workspace {
		display: grid;
		grid-template-rows: auto auto minmax(0, 1fr);
		height: 100%;
		padding: 0;
		gap: 0;
	}

	.workspace__content {
		background: var(--color-bg-panel);
		outline: 1px solid var(--color-border-soft);
		outline-offset: -1px;
		min-height: 0;
		padding: var(--space-3);
	}

	.workspace__session-stack {
		height: 100%;
		min-height: 0;
	}
</style>
