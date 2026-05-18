<script lang="ts">
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
class="layout-smoke-test-layout-template"
bind:this={rootElement}
style={`--layout-template-accent:${accent};font-family:${fontFamily};`}
>
{#if heroItem}
<img class="layout-smoke-test-layout-template__hero" src={heroItem.objectUrl} alt="" />
{:else}
<div class="layout-smoke-test-layout-template__hero layout-smoke-test-layout-template__hero--empty">Layout Smoke Test</div>
{/if}

<div class="layout-smoke-test-layout-template__overlay">
{#if logoItem}
<img class="layout-smoke-test-layout-template__logo" src={logoItem.objectUrl} alt="" />
{/if}
<p class="layout-smoke-test-layout-template__eyebrow">Layout Template</p>
<h1 class="layout-smoke-test-layout-template__headline">{headline}</h1>
<p class="layout-smoke-test-layout-template__subtitle">{subtitle}</p>
</div>
</div>

<style>
.layout-smoke-test-layout-template {
position: relative;
width: 100%;
height: 100%;
overflow: hidden;
background:
radial-gradient(circle at 15% 10%, color-mix(in srgb, var(--layout-template-accent) 34%, transparent), transparent 32%),
#111827;
color: #ffffff;
}

.layout-smoke-test-layout-template__hero {
position: absolute;
inset: 0;
width: 100%;
height: 100%;
object-fit: cover;
opacity: 0.68;
}

.layout-smoke-test-layout-template__hero--empty {
display: flex;
align-items: center;
justify-content: center;
background: linear-gradient(135deg, rgba(149, 128, 255, 0.28), rgba(47, 212, 255, 0.18));
color: rgba(255, 255, 255, 0.36);
font-size: clamp(32px, 7vw, 92px);
font-weight: 700;
}

.layout-smoke-test-layout-template__overlay {
position: absolute;
inset: 8%;
display: flex;
flex-direction: column;
justify-content: flex-end;
padding: 7%;
border: max(2px, 0.22vw) solid color-mix(in srgb, var(--layout-template-accent) 72%, white);
background: linear-gradient(180deg, transparent, rgba(9, 13, 22, 0.68));
}

.layout-smoke-test-layout-template__logo {
position: absolute;
top: 7%;
left: 7%;
width: min(18%, 160px);
height: auto;
object-fit: contain;
}

.layout-smoke-test-layout-template__eyebrow {
margin: 0 0 2%;
color: color-mix(in srgb, var(--layout-template-accent) 72%, white);
font-size: clamp(14px, 1.6vw, 28px);
font-weight: 700;
letter-spacing: 0.12em;
text-transform: uppercase;
}

.layout-smoke-test-layout-template__headline {
margin: 0;
max-width: 82%;
font-size: clamp(42px, 9vw, 136px);
line-height: 0.92;
letter-spacing: -0.06em;
}

.layout-smoke-test-layout-template__subtitle {
margin: 3% 0 0;
max-width: 62%;
font-size: clamp(18px, 2.3vw, 38px);
line-height: 1.18;
color: rgba(255, 255, 255, 0.82);
}
</style>
