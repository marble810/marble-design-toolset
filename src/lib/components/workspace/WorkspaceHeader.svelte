<script lang="ts">
	import { Button, PixelIcon } from '$lib/components/ui/index.js';

	interface Props {
		onOpenTools: () => void;
		onOpenHelp: () => void;
		onOpenSettings: () => void;
	}

	let { onOpenTools, onOpenHelp, onOpenSettings }: Props = $props();
</script>

<header class="workspace-header">
	<div class="workspace-header__brand">
		<div class="workspace-header__brand-copy">
			<strong class="workspace-header__title">Marble Design Toolset</strong>
		</div>
	</div>

	<nav class="workspace-header__actions">
		<Button variant="ghost" size="sm" onclick={onOpenTools}>
			<PixelIcon name="open" size={14} />
			<span>Open</span>
		</Button>
		<Button variant="ghost" size="sm" onclick={onOpenHelp}>
			<PixelIcon name="sparkles" size={14} />
			<span>Help</span>
		</Button>
		<a class="button button--ghost button--sm" href="/docs" target="_blank" rel="noreferrer noopener">
			<PixelIcon name="info-box" size={14} />
			<span>Docs</span>
		</a>
		<Button variant="ghost" size="sm" onclick={onOpenSettings}>
			<PixelIcon name="settings-2" size={14} />
			<span>Settings</span>
		</Button>
	</nav>
</header>

<style>
	.workspace-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		padding: var(--space-2) var(--space-4);
		background: var(--color-bg-panel);
		outline: 1px solid var(--color-border-soft);
		outline-offset: -1px;
	}

	.workspace-header__brand {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		min-width: 0;
	}

	.workspace-header__brand-copy {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}

	.workspace-header__title {
		font-size: var(--font-size-3);
		line-height: var(--line-height-tight);
	}

	.workspace-header__actions {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
</style>