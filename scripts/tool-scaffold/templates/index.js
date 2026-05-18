function formatStringArrayLiteral(values) {
return `[${values.map((value) => `'${value}'`).join(', ')}]`;
}

function withTrailingNewline(value) {
return value.endsWith('\n') ? value : `${value}\n`;
}

export function renderMetadata({ displayName, description, starterType, version, enabled, tags, exportCapabilities }) {
const metadata = {
name: displayName,
desc: description,
tag: tags.length ? tags : ['starter', starterType],
version,
enabled
};

if (exportCapabilities) {
metadata.export = exportCapabilities;
}

return withTrailingNewline(JSON.stringify(metadata, null, 2));
}

export function renderToolDefinition({ componentName, techStacks }) {
const techStackLine = techStacks.length
? `\ttechStack: ${formatStringArrayLiteral(techStacks)},\n`
: '';

return withTrailingNewline(`import metadata from './metadata.json';
import type { ToolDefinition } from '$lib/tool-sdk/index.js';

const definition = {
metadata,
${techStackLine}\tloadComponent: () => import('./${componentName}.svelte')
} satisfies ToolDefinition;

export default definition;
`);
}

function renderSharedLeftPanel({ toolId, starterLabel, techStackLabel, description }) {
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

export function renderRecipeMasterComponent({ toolId, displayName, techStacks, recipe, childComponentName }) {
	if (recipe.id === 'source-preview') {
	return renderSourcePreviewMasterComponent({ toolId, displayName, childComponentName });
	}

	if (recipe.id === 'layout-template') {
	return renderLayoutTemplateMasterComponent({ toolId, displayName, childComponentName });
	}

if (recipe.id === 'three-stage') {
return renderThreeStageMasterComponent({ toolId, displayName, childComponentName });
}

return renderPreviewRecipeMasterComponent({ toolId, displayName, techStacks, recipe, childComponentName });
}

function renderPreviewRecipeMasterComponent({ toolId, displayName, techStacks, recipe, childComponentName }) {
const techStackLabel = techStacks.length ? techStacks.join(', ') : 'None';
const description = `${recipe.label} recipe for ${displayName}. Replace the placeholder with your tool logic when ready.`;

return withTrailingNewline(`<script lang="ts">
import { LeftPanel, PreviewCanvas, RightPanel, Section } from '$lib/components/shell/index.js';
import { Field } from '$lib/components/ui/index.js';
import ${childComponentName} from './components/${childComponentName}.svelte';
</script>

${renderSharedLeftPanel({
toolId,
starterLabel: recipe.id,
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

function renderSourcePreviewMasterComponent({ toolId, displayName, childComponentName }) {
return withTrailingNewline(`<script lang="ts">
import { LeftPanel, PreviewCanvas, RightPanel, Section } from '$lib/components/shell/index.js';
import { DropZone, SourceInputSection, createToolSourceInput } from '$lib/tool-sdk/index.js';
import ${childComponentName} from './components/${childComponentName}.svelte';

const source = createToolSourceInput({ allowedKinds: ['image', 'video', 'text'] });
</script>

<LeftPanel>
<Section title="Overview">
<p class="${toolId}__copy">
Drop or browse for a local image, video, or text file. The shared source workflow owns picker, drop, errors, summaries, and object URL cleanup.
</p>
</Section>

<SourceInputSection {source} />
</LeftPanel>

<RightPanel>
<DropZone {source} ariaLabel="${displayName} source drop zone">
<PreviewCanvas contentWidth={640} contentHeight={360} label="${displayName} Preview">
<${childComponentName} {source} />
</PreviewCanvas>
</DropZone>
</RightPanel>

<style>
.${toolId}__copy {
margin: 0;
color: var(--color-fg-secondary);
}
</style>
`);
}

function renderThreeStageMasterComponent({ toolId, displayName, childComponentName }) {
return withTrailingNewline(`<script lang="ts">
import { FullStage, LeftPanel, RightPanel, Section } from '$lib/components/shell/index.js';
import { Field } from '$lib/components/ui/index.js';
import ${childComponentName} from './components/${childComponentName}.svelte';

let autoRotate = $state(true);
</script>

<LeftPanel>
<Section title="Overview">
<p class="${toolId}__copy">
This recipe declares Three.js and uses the public render host lifecycle inside a FullStage preview.
</p>
</Section>

<Section title="Scene" collapsible>
<Field label="Auto Rotate">
<input class="pixel-checkbox" type="checkbox" bind:checked={autoRotate} />
</Field>
</Section>
</LeftPanel>

<RightPanel>
<FullStage>
<${childComponentName} {autoRotate} />
</FullStage>
</RightPanel>

<style>
.${toolId}__copy {
margin: 0;
color: var(--color-fg-secondary);
}
</style>
`);
}

export function renderRecipeComponent({ toolId, displayName, recipe }) {
switch (recipe.id) {
case 'source-preview':
return renderSourcePreviewComponent({ toolId, displayName });
case 'pixi-preview':
return renderPixiPreviewComponent({ toolId, displayName });
case 'three-stage':
return renderThreeStageComponent({ toolId, displayName });
case 'preview-export':
return renderPreviewExportComponent({ toolId, displayName });
case 'layout-template':
return renderLayoutTemplateComponent({ toolId, displayName });
case 'preview-basic':
default:
return renderPreviewComponent({ toolId, displayName });
}
}

function renderLayoutTemplateMasterComponent({ toolId, displayName, childComponentName }) {
return withTrailingNewline(`<script lang="ts">
import { LeftPanel, PreviewCanvas, RightPanel, Section } from '$lib/components/shell/index.js';
import { DropZone, SourceInputSection, createLayoutToolController } from '$lib/tool-sdk/index.js';
import ${childComponentName} from './components/${childComponentName}.svelte';

let layoutRoot = $state<HTMLElement | null>(null);
let headline = $state('${displayName}');
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
label: '${displayName} Layout',
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
<div class="${toolId}__fields">
<label class="${toolId}__field">
<span>Width</span>
<input class="pixel-input" type="number" value={layout.size.widthInput} oninput={(event) => layout.size.setWidthInput(event.currentTarget.value)} />
</label>
<label class="${toolId}__field">
<span>Height</span>
<input class="pixel-input" type="number" value={layout.size.heightInput} oninput={(event) => layout.size.setHeightInput(event.currentTarget.value)} />
</label>
</div>
</Section>

<Section title="Content" collapsible>
<div class="${toolId}__fields">
<label class="${toolId}__field">
<span>Headline</span>
<input class="pixel-input" bind:value={headline} />
</label>
<label class="${toolId}__field">
<span>Subtitle</span>
<input class="pixel-input" bind:value={subtitle} />
</label>
<label class="${toolId}__field">
<span>Accent Color</span>
<input class="pixel-input" bind:value={accent} />
</label>
</div>
</Section>

<SourceInputSection source={layout.sources} title="Sources" />

<Section title="Fonts" collapsible>
<div class="${toolId}__fields">
<label class="${toolId}__field">
<span>Google Font Family</span>
<input class="pixel-input" bind:value={googleFontFamily} />
</label>
<label class="${toolId}__field">
<span>Google Fonts URL</span>
<input class="pixel-input" bind:value={googleFontUrl} placeholder="https://fonts.google.com/specimen/Inter" />
</label>
<div class="${toolId}__actions">
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
<p class="${toolId}__diagnostic" data-tone={diagnostic.tone}>{diagnostic.message}</p>
{/each}
</div>
</Section>
</LeftPanel>

<RightPanel>
<DropZone source={layout.sources} slotId="hero" ariaLabel="${displayName} hero image drop zone">
<PreviewCanvas contentWidth={layout.size.contentWidth} contentHeight={layout.size.contentHeight} label="${displayName} Preview">
<${childComponentName}
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
.${toolId}__fields {
display: flex;
flex-direction: column;
gap: var(--space-3);
}

.${toolId}__field {
display: flex;
flex-direction: column;
gap: var(--space-1);
color: var(--color-fg-secondary);
font-size: var(--font-size-1);
}

.${toolId}__actions {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-2);
}

.${toolId}__diagnostic {
margin: 0;
color: var(--color-fg-muted);
font-size: var(--font-size-1);
line-height: var(--line-height-base);
}

.${toolId}__diagnostic[data-tone='warning'] {
color: #ffd49a;
}
</style>
`);
}

function renderLayoutTemplateComponent({ toolId, displayName }) {
const childClass = `${toolId}-layout-template`;
return withTrailingNewline(`<script lang="ts">
import type { ImportedImageFileItem } from '$lib/tool-sdk/index.js';

interface Props {
rootElement: HTMLElement | null;
headline: string;
subtitle: string;
accent: string;
fontFamily: string;
heroItem: ImportedImageFileItem | null;
logoItem: ImportedImageFileItem | null;
}

let {
rootElement = $bindable<HTMLElement | null>(null),
headline,
subtitle,
accent,
fontFamily,
heroItem,
logoItem
}: Props = $props();
</script>

<div
class="${childClass}"
bind:this={rootElement}
style={\`--layout-template-accent:\${accent};font-family:\${fontFamily};\`}
>
{#if heroItem}
<img class="${childClass}__hero" src={heroItem.objectUrl} alt="" />
{:else}
<div class="${childClass}__hero ${childClass}__hero--empty">${displayName}</div>
{/if}

<div class="${childClass}__overlay">
{#if logoItem}
<img class="${childClass}__logo" src={logoItem.objectUrl} alt="" />
{/if}
<p class="${childClass}__eyebrow">Layout Template</p>
<h1 class="${childClass}__headline">{headline}</h1>
<p class="${childClass}__subtitle">{subtitle}</p>
</div>
</div>

<style>
.${childClass} {
position: relative;
width: 100%;
height: 100%;
overflow: hidden;
background:
radial-gradient(circle at 15% 10%, color-mix(in srgb, var(--layout-template-accent) 34%, transparent), transparent 32%),
#111827;
color: #ffffff;
}

.${childClass}__hero {
position: absolute;
inset: 0;
width: 100%;
height: 100%;
object-fit: cover;
opacity: 0.68;
}

.${childClass}__hero--empty {
display: flex;
align-items: center;
justify-content: center;
background: linear-gradient(135deg, rgba(149, 128, 255, 0.28), rgba(47, 212, 255, 0.18));
color: rgba(255, 255, 255, 0.36);
font-size: clamp(32px, 7vw, 92px);
font-weight: 700;
}

.${childClass}__overlay {
position: absolute;
inset: 8%;
display: flex;
flex-direction: column;
justify-content: flex-end;
padding: 7%;
border: max(2px, 0.22vw) solid color-mix(in srgb, var(--layout-template-accent) 72%, white);
background: linear-gradient(180deg, transparent, rgba(9, 13, 22, 0.68));
}

.${childClass}__logo {
position: absolute;
top: 7%;
left: 7%;
width: min(18%, 160px);
height: auto;
object-fit: contain;
}

.${childClass}__eyebrow {
margin: 0 0 2%;
color: color-mix(in srgb, var(--layout-template-accent) 72%, white);
font-size: clamp(14px, 1.6vw, 28px);
font-weight: 700;
letter-spacing: 0.12em;
text-transform: uppercase;
}

.${childClass}__headline {
margin: 0;
max-width: 82%;
font-size: clamp(42px, 9vw, 136px);
line-height: 0.92;
letter-spacing: -0.06em;
}

.${childClass}__subtitle {
margin: 3% 0 0;
max-width: 62%;
font-size: clamp(18px, 2.3vw, 38px);
line-height: 1.18;
color: rgba(255, 255, 255, 0.82);
}
</style>
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

function renderSourcePreviewComponent({ toolId, displayName }) {
const childClass = `${toolId}-source-preview`;

return withTrailingNewline(`<script lang="ts">
import type { ToolSourceInput } from '$lib/tool-sdk/index.js';

interface Props {
source: ToolSourceInput;
}

let { source }: Props = $props();
const currentItem = $derived(source.currentItem);
const summary = $derived(source.summary);
</script>

<div class="${childClass}">
{#if currentItem}
<div class="${childClass}__badge">{currentItem.kind} source</div>
<h2 class="${childClass}__title">{currentItem.name}</h2>
<p class="${childClass}__description">{summary?.detail ?? 'Source loaded.'}</p>
{:else}
<div class="${childClass}__badge">Source Preview</div>
<h2 class="${childClass}__title">${displayName}</h2>
<p class="${childClass}__description">Drop a file onto this preview or use Browse in the left panel.</p>
{/if}
</div>

<style>
.${childClass} {
display: flex;
flex-direction: column;
justify-content: flex-end;
width: 100%;
height: 100%;
padding: 32px;
background:
linear-gradient(135deg, rgba(113, 92, 255, 0.16), transparent 42%),
#141c2b;
border: 2px dashed rgba(255, 255, 255, 0.18);
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
font-size: 34px;
line-height: 1;
word-break: break-word;
}

.${childClass}__description {
margin: 0;
max-width: 420px;
color: rgba(255, 255, 255, 0.84);
font-size: var(--font-size-3);
}
</style>
`);
}

function renderPixiPreviewComponent({ toolId, displayName }) {
const childClass = `${toolId}-pixi-preview`;

return withTrailingNewline(`<script lang="ts">
import { onMount } from 'svelte';
import { createPixiApplicationHost, createRenderHostLifecycle } from '$lib/tool-sdk/index.js';

const PREVIEW_WIDTH = 640;
const PREVIEW_HEIGHT = 360;
const renderHost = createRenderHostLifecycle();

let hostElement = $state<HTMLDivElement | null>(null);
const isReady = $derived(renderHost.isReady);
const errorMessage = $derived(renderHost.errorMessage);

onMount(() => {
void renderHost.runInit(async () => {
if (!hostElement) {
throw new Error('Pixi preview host is unavailable.');
}

const sourceCanvas = document.createElement('canvas');
sourceCanvas.width = PREVIEW_WIDTH;
sourceCanvas.height = PREVIEW_HEIGHT;
const context = sourceCanvas.getContext('2d');
if (!context) {
throw new Error('Failed to create Pixi source canvas.');
}

const gradient = context.createLinearGradient(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
gradient.addColorStop(0, '#8f7ff0');
gradient.addColorStop(1, '#2fd4ff');
context.fillStyle = '#111827';
context.fillRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
context.fillStyle = gradient;
context.fillRect(96, 80, 448, 200);
context.fillStyle = 'rgba(255, 255, 255, 0.86)';
context.font = '28px sans-serif';
context.fillText('${displayName}', 120, 188);

const { PIXI, app } = await createPixiApplicationHost(renderHost, {
hostElement,
init: {
width: PREVIEW_WIDTH,
height: PREVIEW_HEIGHT,
backgroundAlpha: 0,
resolution: 1,
autoDensity: false,
autoStart: false
}
});

const texture = PIXI.Texture.from(sourceCanvas);
const sprite = new PIXI.Sprite(texture);
sprite.width = PREVIEW_WIDTH;
sprite.height = PREVIEW_HEIGHT;
app.stage.addChild(sprite);
app.render();
}, 'Failed to initialize Pixi preview.');
});
</script>

<div class="${childClass}" bind:this={hostElement}>
{#if !isReady && !errorMessage}
<div class="${childClass}__overlay">Booting Pixi preview...</div>
{/if}

{#if errorMessage}
<div class="${childClass}__overlay ${childClass}__overlay--error">{errorMessage}</div>
{/if}
</div>

<style>
.${childClass} {
position: relative;
width: 100%;
height: 100%;
background: #111827;
}

.${childClass}__overlay {
position: absolute;
inset: 0;
display: flex;
align-items: center;
justify-content: center;
background: rgba(9, 13, 22, 0.78);
color: var(--color-fg-secondary);
}

.${childClass}__overlay--error {
color: var(--color-danger);
}
</style>
`);
}

function renderPreviewExportComponent({ toolId, displayName }) {
const childClass = `${toolId}-export-preview`;

return withTrailingNewline(`<script lang="ts">
import { onMount } from 'svelte';
import { createCanvas2DRenderHost, createRenderHostLifecycle } from '$lib/tool-sdk/index.js';

const PREVIEW_WIDTH = 640;
const PREVIEW_HEIGHT = 360;
const renderHost = createRenderHostLifecycle();

let hostElement = $state<HTMLDivElement | null>(null);
const isReady = $derived(renderHost.isReady);
const errorMessage = $derived(renderHost.errorMessage);

function paint(context: CanvasRenderingContext2D) {
context.fillStyle = '#111827';
context.fillRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
context.fillStyle = '#8f7ff0';
context.fillRect(64, 56, 512, 248);
context.fillStyle = 'rgba(255, 255, 255, 0.88)';
context.font = '30px sans-serif';
context.fillText('${displayName}', 96, 188);
}

onMount(() => {
void renderHost.runInit(() => {
if (!hostElement) {
throw new Error('Export preview host is unavailable.');
}

const canvasHost = createCanvas2DRenderHost(renderHost, {
width: PREVIEW_WIDTH,
height: PREVIEW_HEIGHT
});
paint(canvasHost.context);
hostElement.replaceChildren(canvasHost.canvas);

renderHost.registerCanvasExporter(
{
kind: 'canvas',
get contentWidth() {
return PREVIEW_WIDTH;
},
get contentHeight() {
return PREVIEW_HEIGHT;
},
getCanvas: () => canvasHost.canvas,
capabilities: {
png: true,
mp4: false
}
},
{ id: 'preview-export', label: 'Preview Export' }
);

renderHost.addCleanup(() => hostElement?.replaceChildren());
}, 'Failed to initialize export preview.');
});
</script>

<div class="${childClass}" bind:this={hostElement}>
{#if !isReady && !errorMessage}
<div class="${childClass}__overlay">Preparing export preview...</div>
{/if}

{#if errorMessage}
<div class="${childClass}__overlay ${childClass}__overlay--error">{errorMessage}</div>
{/if}
</div>

<style>
.${childClass} {
position: relative;
width: 100%;
height: 100%;
background: #111827;
}

.${childClass} canvas {
display: block;
width: 100%;
height: 100%;
}

.${childClass}__overlay {
position: absolute;
inset: 0;
display: flex;
align-items: center;
justify-content: center;
background: rgba(9, 13, 22, 0.78);
color: var(--color-fg-secondary);
}

.${childClass}__overlay--error {
color: var(--color-danger);
}
</style>
`);
}

function renderThreeStageComponent({ toolId }) {
const childClass = `${toolId}-three-stage`;

return withTrailingNewline(`<script lang="ts">
import { onMount } from 'svelte';
import { createRenderHostLifecycle, createThreeRenderHost } from '$lib/tool-sdk/index.js';
import type { Mesh, PerspectiveCamera, Scene, WebGLRenderer } from 'three';

interface Props {
autoRotate: boolean;
}

let { autoRotate }: Props = $props();

const renderHost = createRenderHostLifecycle();
let hostElement = $state<HTMLDivElement | null>(null);
const isReady = $derived(renderHost.isReady);
const errorMessage = $derived(renderHost.errorMessage);

let renderer: WebGLRenderer | null = null;
let scene: Scene | null = null;
let camera: PerspectiveCamera | null = null;
let cube: Mesh | null = null;

onMount(() => {
void renderHost.runInit(async () => {
if (!hostElement) {
throw new Error('Three stage host is unavailable.');
}

const { THREE, trackDisposable } = await createThreeRenderHost(renderHost);
scene = new THREE.Scene();
scene.background = new THREE.Color('#101827');

camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(1.8, 1.5, 3);
camera.lookAt(0, 0, 0);

renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
hostElement.replaceChildren(renderer.domElement);

const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: '#8f7ff0', roughness: 0.52 });
cube = new THREE.Mesh(geometry, material);
scene.add(cube);
scene.add(new THREE.AmbientLight('#b8c4ff', 0.7));
const light = new THREE.DirectionalLight('#ffffff', 1.2);
light.position.set(2.5, 3, 4);
scene.add(light);

trackDisposable(geometry);
trackDisposable(material);
trackDisposable(renderer);

const resize = () => {
if (!hostElement || !renderer || !camera) return;
const width = Math.max(hostElement.clientWidth, 1);
const height = Math.max(hostElement.clientHeight, 1);
renderer.setSize(width, height, false);
camera.aspect = width / height;
camera.updateProjectionMatrix();
};

resize();
const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(hostElement);
renderHost.addCleanup(() => resizeObserver.disconnect());
renderHost.addCleanup(() => hostElement?.replaceChildren());

renderHost.startAnimationLoop(() => {
if (!renderer || !scene || !camera || !cube) return;
if (autoRotate) {
cube.rotation.x += 0.01;
cube.rotation.y += 0.014;
}
renderer.render(scene, camera);
});
}, 'Failed to initialize Three stage.');
});
</script>

<div class="${childClass}" bind:this={hostElement}>
{#if !isReady && !errorMessage}
<div class="${childClass}__overlay">Booting Three stage...</div>
{/if}

{#if errorMessage}
<div class="${childClass}__overlay ${childClass}__overlay--error">{errorMessage}</div>
{/if}
</div>

<style>
.${childClass} {
position: relative;
width: 100%;
height: 100%;
background: #101827;
}

.${childClass}__overlay {
position: absolute;
inset: 0;
display: flex;
align-items: center;
justify-content: center;
background: rgba(9, 13, 22, 0.78);
color: var(--color-fg-secondary);
}

.${childClass}__overlay--error {
color: var(--color-danger);
}
</style>
`);
}

export function renderStageComponent({ toolId, displayName, techStacks }) {
const childClass = `${toolId}-stage`;
const techStackLabel = techStacks.length ? techStacks.join(', ') : 'None';

return withTrailingNewline(`<script lang="ts">
import { onMount } from 'svelte';
import { createRenderHostLifecycle } from '$lib/tool-sdk/index.js';

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
