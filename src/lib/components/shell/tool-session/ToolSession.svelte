<script lang="ts">
	import type { Component } from 'svelte';
	import { Dialog } from '$lib/components/ui/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { ToolShell } from '../tool-shell/index.js';
	import { loadTechStacks } from '$lib/runtime/tech-stack';
	import { loadToolDefinition } from '$lib/runtime/tool-registry';
	import {
		dispatchToolMenuAction,
		setToolRuntimeContext,
		type ToolRuntimeContextValue
	} from '$lib/runtime/tool-runtime-context';
	import {
		setToolSessionContext,
		type ToolSessionContextValue
	} from '$lib/runtime/tool-session-context';
	import { setToolShellContext, type ToolShellContextValue } from '$lib/runtime/tool-shell-context';
	import type { ToolDefinition } from '$lib/types/tool';
	import type { TechStackKey, TechStackModule, TechStackModuleMap } from '$lib/types/tech-stack';

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

	type LoadLogTone = 'info' | 'success' | 'error';

	interface LoadLogEntry {
		id: number;
		message: string;
		tone: LoadLogTone;
	}

	let { toolId, isActive = false, leftPanelWidthVw = 28 }: Props = $props();

	let aboutDialogOpen = $state(false);
	let isLoading = $state(false);
	let loadError = $state('');
	let loadLogs = $state<LoadLogEntry[]>([]);
	let definition = $state<ToolDefinition | null>(null);
	let SessionComponent = $state<Component<any> | null>(null);
	let declaredTechStacks = $state<readonly TechStackKey[]>([]);
	let loadedTechStacks = $state<Partial<TechStackModuleMap>>({});
	let reloadToken = $state(0);
	let loadVersion = 0;
	let nextLoadLogId = 0;

	const activeListeners = new Set<(active: boolean) => void>();
	let previousSessionActive: boolean | null = null;
	const toolSessionContext: ToolSessionContextValue = {
		get active() {
			return isActive;
		},
		isActive: () => toolSessionContext.active,
		onActiveChange: (callback) => {
			activeListeners.add(callback);
			const currentActive = toolSessionContext.active;
			previousSessionActive = currentActive;
			callback(currentActive);
			return () => {
				activeListeners.delete(callback);
			};
		}
	};

	const toolShellContext = $state<ToolShellContextValue>({
		metadata: EMPTY_TOOL_METADATA,
		menuActions: [],
		openAbout: () => {
			aboutDialogOpen = true;
		},
		onMenuAction: () => {}
	});

	const toolRuntimeContext = $state<ToolRuntimeContextValue>({
		toolId: '',
		metadata: EMPTY_TOOL_METADATA,
		isActive: () => isActive,
		menuActions: [],
		declaredTechStacks: [],
		loadedTechStacks: {},
		getLoadedTechStack: (key) => loadedTechStacks[key] as TechStackModule<typeof key> | undefined,
		dispatchMenuAction: (actionId) => {
			dispatchToolMenuAction(definition, toolRuntimeContext, actionId);
		}
	});

	setToolSessionContext(toolSessionContext);
	setToolShellContext(toolShellContext);
	setToolRuntimeContext(toolRuntimeContext);

	function retryLoad() {
		reloadToken += 1;
	}

	function createLoadLogEntry(message: string, tone: LoadLogTone = 'info'): LoadLogEntry {
		nextLoadLogId += 1;
		return {
			id: nextLoadLogId,
			message,
			tone
		};
	}

	$effect(() => {
		if (!isActive && aboutDialogOpen) {
			aboutDialogOpen = false;
		}
	});

	$effect(() => {
		const nextActive = isActive;
		if (previousSessionActive === nextActive) {
			return;
		}

		previousSessionActive = nextActive;
		for (const listener of [...activeListeners]) {
			listener(nextActive);
		}
	});

	$effect(() => {
		const nextDefinition = definition;
		const nextMetadata = nextDefinition?.metadata ?? EMPTY_TOOL_METADATA;
		const nextMenuActions = nextDefinition?.menuActions ?? [];

		toolRuntimeContext.toolId = toolId;
		toolRuntimeContext.metadata = nextMetadata;
		toolRuntimeContext.menuActions = nextMenuActions;
		toolRuntimeContext.declaredTechStacks = declaredTechStacks;
		toolRuntimeContext.loadedTechStacks = loadedTechStacks;
		toolRuntimeContext.getLoadedTechStack = (key) =>
			loadedTechStacks[key] as TechStackModule<typeof key> | undefined;
		toolRuntimeContext.dispatchMenuAction = (actionId) => {
			dispatchToolMenuAction(nextDefinition, toolRuntimeContext, actionId);
		};

		toolShellContext.metadata = nextMetadata;
		toolShellContext.menuActions = nextMenuActions;
		toolShellContext.openAbout = () => {
			aboutDialogOpen = true;
		};
		toolShellContext.onMenuAction = (actionId) => {
			toolRuntimeContext.dispatchMenuAction(actionId);
		};
	});

	$effect(() => {
		toolId;
		reloadToken;

		let disposed = false;
		const currentLoad = ++loadVersion;
		const currentLoadLogs: LoadLogEntry[] = [];
		const appendLoadLog = (message: string, tone: LoadLogTone = 'info') => {
			if (disposed || currentLoad !== loadVersion) {
				return;
			}

			currentLoadLogs.push(createLoadLogEntry(message, tone));
			loadLogs = [...currentLoadLogs];
		};

		loadError = '';
		isLoading = true;
		loadLogs = [];
		definition = null;
		SessionComponent = null;
		declaredTechStacks = [];
		loadedTechStacks = {};
		nextLoadLogId = 0;

		void (async () => {
			try {
				appendLoadLog('Loading runtime definition...');
				const nextDefinition = await loadToolDefinition(toolId);
				appendLoadLog('Runtime definition loaded.', 'success');

				const nextDeclaredTechStacks = nextDefinition.techStack ?? [];
				declaredTechStacks = nextDeclaredTechStacks;

				if (nextDeclaredTechStacks.length > 0) {
					appendLoadLog('Loading declared tech stacks...');
					loadedTechStacks = await loadTechStacks(nextDeclaredTechStacks);
					appendLoadLog('Declared tech stacks loaded.', 'success');
				} else {
					loadedTechStacks = {};
					appendLoadLog('No declared tech stacks to load.', 'success');
				}

				appendLoadLog('Loading tool component...');
				const componentModule = await nextDefinition.loadComponent();

				if (disposed || currentLoad !== loadVersion) {
					return;
				}

				appendLoadLog('Tool component loaded.', 'success');
				appendLoadLog('Tool session is ready to mount.', 'success');
				definition = nextDefinition;
				SessionComponent = componentModule.default;
			} catch (error) {
				if (disposed || currentLoad !== loadVersion) {
					return;
				}

				appendLoadLog('Tool load failed.', 'error');
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
			<p class="tool-session__status-copy">Tracking the current load attempt below.</p>
			<ul class="tool-session__log-list" aria-live="polite">
				{#each loadLogs as entry (entry.id)}
					<li class={`tool-session__log-item tool-session__log-item--${entry.tone}`}>
						<span class="tool-session__log-marker" aria-hidden="true"></span>
						<span>{entry.message}</span>
					</li>
				{/each}
			</ul>
		</div>
	{:else if loadError}
		<div class="tool-session__status">
			<p class="tool-session__status-title">Tool failed to load</p>
			<p class="tool-session__status-copy">{loadError}</p>
			<ul class="tool-session__log-list" aria-live="polite">
				{#each loadLogs as entry (entry.id)}
					<li class={`tool-session__log-item tool-session__log-item--${entry.tone}`}>
						<span class="tool-session__log-marker" aria-hidden="true"></span>
						<span>{entry.message}</span>
					</li>
				{/each}
			</ul>
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
		gap: var(--space-4);
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

	.tool-session__log-list {
		width: min(100%, 420px);
		min-height: 168px;
		margin: 0;
		padding: var(--space-3);
		display: grid;
		align-content: start;
		gap: var(--space-2);
		list-style: none;
		border: 1px solid var(--color-border-soft);
		background: var(--color-bg-surface);
		text-align: left;
	}

	.tool-session__log-item {
		display: grid;
		grid-template-columns: 12px minmax(0, 1fr);
		align-items: start;
		gap: var(--space-2);
		padding: var(--space-2);
		border: 1px solid var(--color-border-soft);
		background: var(--color-bg-inset);
		color: var(--color-fg-secondary);
		font-size: var(--font-size-2);
		line-height: var(--line-height-base);
	}

	.tool-session__log-item--success {
		color: var(--color-fg-primary);
	}

	.tool-session__log-item--error {
		border-color: oklch(from var(--color-danger) l c h / 40%);
		color: var(--color-danger);
	}

	.tool-session__log-marker {
		width: 8px;
		height: 8px;
		margin-top: 5px;
		border: 1px solid currentColor;
		background: currentColor;
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