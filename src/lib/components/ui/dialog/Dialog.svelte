<script lang="ts">
	import { cn } from '$lib/utils.js';

	interface Props {
		open?: boolean;
		onclose?: () => void;
		class?: string;
		children?: import('svelte').Snippet;
	}

	let { open = $bindable(false), onclose, class: className, children }: Props = $props();

	function handleBackdropClick() {
		open = false;
		onclose?.();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			open = false;
			onclose?.();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		role="presentation"
		class="fixed inset-0 z-[999] flex items-center justify-center"
		onclick={handleBackdropClick}
	>
		<div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
		<div
			role="dialog"
			aria-modal="true"
			class={cn(
				'relative z-10 bg-card border border-border rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col',
				className
			)}
			onclick={(e) => e.stopPropagation()}
		>
			{@render children?.()}
		</div>
	</div>
{/if}
