function formatStringArrayLiteral(values) {
	return `[${values.map((value) => `'${value}'`).join(', ')}]`;
}

function withTrailingNewline(value) {
	return value.endsWith('\n') ? value : `${value}\n`;
}

export function renderMetadata({ displayName, description, starterType, version, enabled, tags }) {
	const metadata = {
		name: displayName,
		desc: description,
		tag: tags.length ? tags : ['starter', starterType],
		version,
		enabled
	};

	return withTrailingNewline(JSON.stringify(metadata, null, 2));
}

export function renderToolDefinition({ componentName, techStacks }) {
	const techStackLine = techStacks.length
		? `\ttechStack: ${formatStringArrayLiteral(techStacks)},\n`
		: '';

	return withTrailingNewline(`import metadata from './metadata.json';
import type { ToolDefinition } from '$lib/types/tool';

const definition = {
	metadata,
${techStackLine}\tloadComponent: () => import('./${componentName}.svelte')
} satisfies ToolDefinition;

export default definition;
`);
}

function renderSharedLeftPanel({ toolId, displayName, starterLabel, techStackLabel, description }) {
	return `<LeftPanel>
	<Section title="Overview">
		<p class="${toolId}__copy">
			${description}
		</p>
	</Section>

	<Section title="Starter" collapsible>
		<div class="${toolId}__fields">
			<Field label="Starter Type">
				<p class="${toolId}__copy">${starterLabel}</p>
			</Field>
			<Field label="Declared Tech Stacks">
				<p class="${toolId}__copy">${techStackLabel}</p>
			</Field>
		</div>
	</Section>
</LeftPanel>`;
}

function renderSharedStyle(toolId) {
	return `<style>
	.${toolId}__copy {
		margin: 0;
		color: var(--color-fg-secondary);
	}

	.${toolId}__fields {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
</style>`;
}

export function renderPreviewMasterComponent({ toolId, componentName, displayName, techStacks }) {
	const childComponentName = `${componentName}Preview`;
	const description = `This preview starter wires ${displayName} into the shared shell with a fixed-size preview stage.`;
	const techStackLabel = techStacks.length ? techStacks.join(', ') : 'None';

	return withTrailingNewline(`<script lang="ts">
	import { LeftPanel, PreviewCanvas, RightPanel, Section } from '$lib/components/shell/index.js';
	import { Field } from '$lib/components/ui/index.js';
	import ${childComponentName} from './components/${childComponentName}.svelte';
</script>

${renderSharedLeftPanel({
		toolId,
		displayName,
		starterLabel: 'PreviewCanvas',
		techStackLabel,
		description
	})}

<RightPanel>
	<PreviewCanvas contentWidth={640} contentHeight={360} label="${displayName} Preview">
		<${childComponentName} />
	</PreviewCanvas>
</RightPanel>

${renderSharedStyle(toolId)}
`);
}

export function renderStageMasterComponent({ toolId, componentName, displayName, techStacks }) {
	const childComponentName = `${componentName}Stage`;
	const description = `This stage starter wires ${displayName} into the shared shell with a full-bleed right panel.`;
	const techStackLabel = techStacks.length ? techStacks.join(', ') : 'None';

	return withTrailingNewline(`<script lang="ts">
	import { FullStage, LeftPanel, RightPanel, Section } from '$lib/components/shell/index.js';
	import { Field } from '$lib/components/ui/index.js';
	import ${childComponentName} from './components/${childComponentName}.svelte';
</script>

${renderSharedLeftPanel({
		toolId,
		displayName,
		starterLabel: 'FullStage',
		techStackLabel,
		description
	})}

<RightPanel>
	<FullStage>
		<${childComponentName} />
	</FullStage>
</RightPanel>

${renderSharedStyle(toolId)}
`);
}

export function renderPreviewComponent({ toolId, displayName }) {
	const childClass = `${toolId}-preview`;

	return withTrailingNewline(`<div class="${childClass}">
	<div class="${childClass}__badge">Preview Starter</div>
	<h2 class="${childClass}__title">${displayName}</h2>
	<p class="${childClass}__description">Replace this placeholder with your tool preview.</p>
</div>

<style>
	.${childClass} {
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		width: 100%;
		height: 100%;
		padding: 32px;
		background: #1a2130;
		border: 2px solid rgba(255, 255, 255, 0.16);
		box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.04);
	}

	.${childClass}__badge {
		display: inline-flex;
		align-self: flex-start;
		align-items: center;
		height: 22px;
		padding: 0 var(--space-2);
		border: 1px solid rgba(255, 255, 255, 0.14);
		background: rgba(9, 13, 22, 0.72);
		color: var(--color-fg-secondary);
		font-size: var(--font-size-1);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.${childClass}__title {
		margin: var(--space-4) 0 var(--space-2);
		font-size: 42px;
		line-height: 1;
	}

	.${childClass}__description {
		margin: 0;
		max-width: 360px;
		color: rgba(255, 255, 255, 0.84);
		font-size: var(--font-size-3);
	}
</style>
`);
}

export function renderStageComponent({ toolId, displayName, techStacks }) {
	const childClass = `${toolId}-stage`;
	const techStackLabel = techStacks.length ? techStacks.join(', ') : 'None';

	return withTrailingNewline(`<script lang="ts">
	import { onMount } from 'svelte';
	import { createRenderHostLifecycle } from '$lib/runtime/render-host/index.js';

	const renderHost = createRenderHostLifecycle();
	let hostElement = $state<HTMLDivElement | null>(null);
	const isReady = $derived(renderHost.isReady);
	const errorMessage = $derived(renderHost.errorMessage);

	onMount(() => {
		void renderHost.runInit(() => {
			if (!hostElement) {
				throw new Error('Stage host is unavailable.');
			}
		}, 'Failed to initialize stage host.');
	});
</script>

<div class="${childClass}" bind:this={hostElement}>
	<div class="${childClass}__hud">
		<div class="${childClass}__badge">Stage Starter</div>
		<h2 class="${childClass}__title">${displayName}</h2>
		<p class="${childClass}__description">Attach your render host, canvas, or scene inside this full-bleed stage.</p>
		<p class="${childClass}__meta">Declared tech stacks: ${techStackLabel}</p>
	</div>

	{#if !isReady && !errorMessage}
		<div class="${childClass}__overlay">Preparing render host...</div>
	{/if}

	{#if errorMessage}
		<div class="${childClass}__overlay ${childClass}__overlay--error">{errorMessage}</div>
	{/if}
</div>

<style>
	.${childClass} {
		position: relative;
		display: flex;
		align-items: flex-end;
		width: 100%;
		height: 100%;
		padding: 24px;
		background:
			radial-gradient(circle at top left, rgba(255, 255, 255, 0.12), transparent 28%),
			linear-gradient(135deg, rgba(34, 44, 65, 0.94), rgba(12, 17, 29, 0.96));
	}

	.${childClass}__hud {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		max-width: 360px;
		padding: 20px;
		border: 1px solid rgba(255, 255, 255, 0.12);
		background: rgba(8, 12, 20, 0.82);
		backdrop-filter: blur(10px);
	}

	.${childClass}__badge {
		display: inline-flex;
		align-self: flex-start;
		align-items: center;
		height: 22px;
		padding: 0 var(--space-2);
		border: 1px solid rgba(255, 255, 255, 0.14);
		color: var(--color-fg-secondary);
		font-size: var(--font-size-1);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.${childClass}__title {
		margin: 0;
		font-size: 32px;
		line-height: 1;
	}

	.${childClass}__description,
	.${childClass}__meta {
		margin: 0;
		color: rgba(255, 255, 255, 0.84);
	}

	.${childClass}__meta {
		color: var(--color-fg-secondary);
		font-size: var(--font-size-1);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.${childClass}__overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(8, 12, 20, 0.82);
		color: var(--color-fg-secondary);
	}

	.${childClass}__overlay--error {
		color: var(--color-danger);
	}
</style>
`);
}