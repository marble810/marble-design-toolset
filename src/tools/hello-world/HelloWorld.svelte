<script lang="ts">
    import { LeftPanel, PreviewCanvas, RightPanel, Section } from '$lib/components/shell/index.js';
</script>

<LeftPanel>
    <Section title="Welcome">
        <p class="hello-world__copy">
            This starter tool confirms the new shell, runtime loader, and preview stage are wired correctly.
        </p>
    </Section>

    <Section title="What It Covers" collapsible>
        <ul class="hello-world__list">
            <li>Framework-owned header and tab runtime</li>
            <li>Tool-owned left panel and preview content</li>
            <li>Shared preview canvas with fit and zoom controls</li>
        </ul>
    </Section>
</LeftPanel>

<RightPanel>
    <PreviewCanvas contentWidth={640} contentHeight={360} label="Starter Preview">
        <div class="hello-world__preview">
            <div class="hello-world__badge">Framework Ready</div>
            <h2 class="hello-world__title">Hello World</h2>
            <p class="hello-world__description">
                The legacy demo page has been replaced by the new workspace shell.
            </p>
        </div>
    </PreviewCanvas>
</RightPanel>

<style>
    .hello-world__copy {
        margin: 0;
        color: var(--color-fg-secondary);
    }

    .hello-world__list {
        margin: 0;
        padding-left: 18px;
        color: var(--color-fg-secondary);
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
    }

    .hello-world__preview {
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        width: 100%;
        height: 100%;
        padding: 32px;
        background: #1a2130;
        border: 2px solid rgba(149, 128, 255, 0.65);
        box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.04);
    }

    .hello-world__badge {
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

    .hello-world__title {
        margin: var(--space-4) 0 var(--space-2);
        font-size: 42px;
        line-height: 1;
    }

    .hello-world__description {
        margin: 0;
        max-width: 360px;
        color: rgba(255, 255, 255, 0.84);
        font-size: var(--font-size-3);
    }
</style>