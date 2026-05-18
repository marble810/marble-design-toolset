<script lang="ts">
import { LeftPanel, PreviewCanvas, RightPanel, Section } from '$lib/components/shell/index.js';
import { DropZone, SourceInputSection, createLayoutToolController } from '$lib/tool-sdk/index.js';
import LayoutSmokeTestLayoutPreview from './components/LayoutSmokeTestLayoutPreview.svelte';

let layoutRoot = $state<HTMLElement | null>(null);
let headline = $state('Layout Smoke Test');
let subtitle = $state('Responsive DOM layout template');
let accent = $state('#9580ff');
let googleFontFamily = $state('Inter');
let googleFontUrl = $state('');

function openGoogleFonts() {
	if (typeof window === 'undefined') {
		return;
	}

	window.open(layout.fonts.getGoogleFontsBrowseUrl(googleFontUrl || googleFontFamily), '_blank', 'noopener,noreferrer');
}

async function loadGoogleFontFromUrl() {
	const parsed = await layout.fonts.loadGoogleFontFromUrl(googleFontUrl);
	if (parsed) {
		googleFontFamily = parsed.family;
	}
}

const layout = createLayoutToolController({
size: {
defaultWidth: 1080,
defaultHeight: 1080,
minWidth: 320,
maxWidth: 4096,
minHeight: 320,
maxHeight: 4096
},
sources: {
slots: [
{
id: 'hero',
name: 'Hero Image',
desc: 'Primary image used by the template.',
allowedKinds: ['image'],
required: false,
maxSizeMB: 12
},
{
id: 'logo',
name: 'Logo Image',
desc: 'Optional logo or mark.',
allowedKinds: ['image'],
required: false,
maxSizeMB: 4
},
{
id: 'font',
name: 'Uploaded Font',
desc: 'Optional custom .ttf, .otf, .woff, or .woff2 font.',
allowedKinds: ['font'],
required: false,
maxSizeMB: 8
}
]
},
fonts: {
defaultFamily: 'system-ui, sans-serif',
systemFallback: 'system-ui, sans-serif',
googleWeights: [400, 700]
},
export: {
id: 'layout-template',
label: 'Layout Smoke Test Layout',
getElement: () => layoutRoot,
	domOptions: {
	backgroundColor: '#111827',
	filter: (node) => !(node instanceof Element) || !node.hasAttribute('data-export-hidden')
	}
	}
});

const hero = $derived(layout.sources.getSlot('hero')?.currentItem);
const logo = $derived(layout.sources.getSlot('logo')?.currentItem);
</script>

<LeftPanel>
<Section title="Canvas">
<div class="layout-smoke-test__fields">
<label class="layout-smoke-test__field">
<span>Width</span>
<input class="pixel-input" type="number" value={layout.size.widthInput} oninput={(event) => layout.size.setWidthInput(event.currentTarget.value)} />
</label>
<label class="layout-smoke-test__field">
<span>Height</span>
<input class="pixel-input" type="number" value={layout.size.heightInput} oninput={(event) => layout.size.setHeightInput(event.currentTarget.value)} />
</label>
</div>
</Section>

<Section title="Content" collapsible>
<div class="layout-smoke-test__fields">
<label class="layout-smoke-test__field">
<span>Headline</span>
<input class="pixel-input" bind:value={headline} />
</label>
<label class="layout-smoke-test__field">
<span>Subtitle</span>
<input class="pixel-input" bind:value={subtitle} />
</label>
<label class="layout-smoke-test__field">
<span>Accent Color</span>
<input class="pixel-input" bind:value={accent} />
</label>
</div>
</Section>

<SourceInputSection source={layout.sources} title="Sources" />

<Section title="Fonts" collapsible>
<div class="layout-smoke-test__fields">
<label class="layout-smoke-test__field">
<span>Google Font Family</span>
<input class="pixel-input" bind:value={googleFontFamily} />
</label>
<label class="layout-smoke-test__field">
<span>Google Fonts URL</span>
<input class="pixel-input" bind:value={googleFontUrl} placeholder="https://fonts.google.com/specimen/Inter" />
</label>
<div class="layout-smoke-test__actions">
<button class="pixel-button" type="button" onclick={openGoogleFonts}>
Open Google Fonts
</button>
<button class="pixel-button" type="button" disabled={layout.fonts.loading} onclick={() => void layout.fonts.loadGoogleFont(googleFontFamily)}>
{layout.fonts.loading ? 'Loading...' : 'Load Google Font'}
</button>
<button class="pixel-button" type="button" disabled={layout.fonts.loading || !googleFontUrl.trim()} onclick={() => void loadGoogleFontFromUrl()}>
{layout.fonts.loading ? 'Loading...' : 'Parse Google Fonts URL'}
</button>
<button class="pixel-button" type="button" onclick={() => void layout.fonts.useUploadedFont('font')}>
Use Uploaded Font
</button>
</div>
{#each layout.diagnostics as diagnostic (diagnostic.id)}
<p class="layout-smoke-test__diagnostic" data-tone={diagnostic.tone}>{diagnostic.message}</p>
{/each}
</div>
</Section>
</LeftPanel>

<RightPanel>
<DropZone source={layout.sources} slotId="hero" ariaLabel="Layout Smoke Test hero image drop zone">
<PreviewCanvas contentWidth={layout.size.contentWidth} contentHeight={layout.size.contentHeight} label="Layout Smoke Test Preview">
<LayoutSmokeTestLayoutPreview
bind:rootElement={layoutRoot}
{headline}
{subtitle}
{accent}
fontFamily={layout.fonts.family}
heroItem={hero?.kind === 'image' ? hero : null}
logoItem={logo?.kind === 'image' ? logo : null}
/>
</PreviewCanvas>
</DropZone>
</RightPanel>

<style>
.layout-smoke-test__fields {
display: flex;
flex-direction: column;
gap: var(--space-3);
}

.layout-smoke-test__field {
display: flex;
flex-direction: column;
gap: var(--space-1);
color: var(--color-fg-secondary);
font-size: var(--font-size-1);
}

.layout-smoke-test__actions {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-2);
}

.layout-smoke-test__diagnostic {
margin: 0;
color: var(--color-fg-muted);
font-size: var(--font-size-1);
line-height: var(--line-height-base);
}

.layout-smoke-test__diagnostic[data-tone='warning'] {
color: #ffd49a;
}
</style>
