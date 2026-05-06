<script lang="ts">
	import { Dialog } from '$lib/components/ui/index.js';

	interface Props {
		open: boolean;
	}

	let { open = $bindable(false) }: Props = $props();
</script>

<Dialog bind:open title="Help" description="Current workspace behavior and constraints." width="md">
	<div class="dialog-copy">
		<p>The workspace uses a framework-owned shell with hash-based tool routing and local tab persistence.</p>
		<p>Open tabs keep their in-memory state while you switch between them, and they are only destroyed when you close the tab.</p>
		<p>Tools only render left panel controls and right panel preview content. The shell owns tabs, dialogs, settings, and preview navigation.</p>
		<p>The UI is currently English-only and requires a minimum width of 720px.</p>
	</div>
</Dialog>

<style>
	.dialog-copy {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.dialog-copy p {
		margin: 0;
		color: var(--color-fg-secondary);
	}
</style>