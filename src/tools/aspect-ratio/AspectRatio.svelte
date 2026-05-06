<script lang="ts">
  import { Button, Field, PresetGrid } from "$lib/components/ui/index.js";
  import {
    createPreviewCanvasFooterInfo,
    footerBodyLine,
    footerHeaderIconAndTitle,
    LeftPanel,
    PreviewCanvas,
    RightPanel,
    Section,
  } from "$lib/components/shell/index.js";

  interface PresetRatio {
    label: string;
    w: number;
    h: number;
  }

  const PRESETS: PresetRatio[] = [
    { label: "16:9", w: 16, h: 9 },
    { label: "4:3", w: 4, h: 3 },
    { label: "1:1", w: 1, h: 1 },
    { label: "21:9", w: 21, h: 9 },
    { label: "9:16", w: 9, h: 16 },
    { label: "3:2", w: 3, h: 2 },
    { label: "2:1", w: 2, h: 1 },
    { label: "5:4", w: 5, h: 4 },
    { label: "4:5", w: 4, h: 5 },
  ];

  const PRESET_ITEMS = PRESETS.map((preset) => ({
    value: preset.label,
    label: preset.label,
  }));

  // Reactive state
  let ratioW = $state(16);
  let ratioH = $state(9);
  let widthPx = $state(1920);
  let heightPx = $state(1080);
  let customRatioW = $state("");
  let customRatioH = $state("");

  let activePreset = $state<string | null>("16:9");

  function selectPreset(preset: PresetRatio) {
    ratioW = preset.w;
    ratioH = preset.h;
    activePreset = preset.label;
    customRatioW = "";
    customRatioH = "";
    // Recalculate height from current width
    heightPx = Math.round((widthPx * ratioH) / ratioW);
  }

  function selectPresetByLabel(label: string) {
    const preset = PRESETS.find((entry) => entry.label === label);
    if (preset) {
      selectPreset(preset);
    }
  }

  let widthError = $state("");
  let heightError = $state("");
  let customRatioError = $state("");

  function applyCustomRatio() {
    const w = parseFloat(customRatioW);
    const h = parseFloat(customRatioH);
    if (!customRatioW || !customRatioH || isNaN(w) || isNaN(h)) {
      customRatioError = "Enter valid numbers for both W and H.";
      return;
    }
    if (w <= 0 || h <= 0) {
      customRatioError = "Values must be greater than zero.";
      return;
    }
    customRatioError = "";
    ratioW = w;
    ratioH = h;
    activePreset = null;
    heightPx = Math.round((widthPx * h) / w);
  }

  function onWidthChange(e: Event) {
    const raw = (e.target as HTMLInputElement).value;
    const v = parseInt(raw);
    if (!raw || isNaN(v) || v <= 0) {
      widthError = "Enter a positive integer.";
      return;
    }
    widthError = "";
    widthPx = v;
    heightPx = Math.round((v * ratioH) / ratioW);
  }

  function onHeightChange(e: Event) {
    const raw = (e.target as HTMLInputElement).value;
    const v = parseInt(raw);
    if (!raw || isNaN(v) || v <= 0) {
      heightError = "Enter a positive integer.";
      return;
    }
    heightError = "";
    heightPx = v;
    widthPx = Math.round((v * ratioW) / ratioH);
  }

  let ratioLabel = $derived(`${ratioW}:${ratioH}`);

  let footerInfo = $derived.by(() =>
    createPreviewCanvasFooterInfo({
      header: footerHeaderIconAndTitle("aspect-ratio", "Frame Details"),
      lines: [
        footerBodyLine(`Ratio: ${ratioLabel}`),
        footerBodyLine(`Size: ${widthPx} x ${heightPx}`),
        footerBodyLine(
          "This line is intentionally long to verify ellipsis and hover tooltip behavior.",
        ),
      ],
    }),
  );
</script>

<LeftPanel>
  <Section title="Presets">
    <PresetGrid
      items={PRESET_ITEMS}
      value={activePreset}
      onselect={selectPresetByLabel}
    />
  </Section>

  <Section title="Custom Ratio" collapsible>
    <div class="aspect-ratio-tool__custom-fields">
      <input
        type="number"
        min="1"
        placeholder="W"
        bind:value={customRatioW}
        class="pixel-input"
      />
      <span class="aspect-ratio-tool__colon">:</span>
      <input
        type="number"
        min="1"
        placeholder="H"
        bind:value={customRatioH}
        class="pixel-input"
      />
      <Button variant="solid" size="sm" onclick={applyCustomRatio}>Apply</Button
      >
    </div>

    {#if customRatioError}
      <p class="aspect-ratio-tool__error">{customRatioError}</p>
    {:else}
      <p class="aspect-ratio-tool__hint">Current custom ratio: {ratioLabel}</p>
    {/if}
  </Section>

  <Section title="Dimensions">
    <div class="aspect-ratio-tool__dimension-fields">
      <Field label="Width (px)" forId="aspect-ratio-width" error={widthError}>
        <input
          id="aspect-ratio-width"
          type="number"
          min="1"
          value={widthPx}
          onchange={onWidthChange}
          class="pixel-input"
        />
      </Field>

      <Field label="Height (px)" forId="aspect-ratio-height" error={heightError}>
        <input
          id="aspect-ratio-height"
          type="number"
          min="1"
          value={heightPx}
          onchange={onHeightChange}
          class="pixel-input"
        />
      </Field>
    </div>
  </Section>

  <Section title="Current Frame" collapsible>
    <div class="aspect-ratio-tool__stats">
      <div class="aspect-ratio-tool__stat-row">
        <span class="aspect-ratio-tool__stat-label">Ratio</span>
        <strong class="aspect-ratio-tool__stat-value">{ratioLabel}</strong>
      </div>
      <div class="aspect-ratio-tool__stat-row">
        <span class="aspect-ratio-tool__stat-label">Dimensions</span>
        <strong class="aspect-ratio-tool__stat-value"
          >{widthPx} × {heightPx}</strong
        >
      </div>
      <div class="aspect-ratio-tool__stat-row">
        <span class="aspect-ratio-tool__stat-label">Decimal</span>
        <strong class="aspect-ratio-tool__stat-value"
          >{(widthPx / heightPx).toFixed(4)} : 1</strong
        >
      </div>
    </div>
  </Section>
</LeftPanel>

<RightPanel>
  <PreviewCanvas
    contentHeight={heightPx}
    contentWidth={widthPx}
    defaultZoom="1:1"
    label={`Aspect Ratio: ${ratioLabel}`}
    footerInfo={footerInfo as any}
  >
    <div class="Canvas-Title">
      <p>ASPECT RATIO CALCULATOR</p>
    </div>
  </PreviewCanvas>
</RightPanel>

<style>
  .Canvas-Title {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: var(--color-fg-muted);
    font-size: var(--font-size-3);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    pointer-events: none;
    overflow: hidden;
  }

  .aspect-ratio-tool__custom-fields {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto;
    gap: var(--space-2);
    align-items: center;
  }

  .aspect-ratio-tool__colon {
    color: var(--color-fg-muted);
    font-size: var(--font-size-3);
    font-weight: 700;
  }

  .aspect-ratio-tool__hint {
    margin: 0;
    color: var(--color-fg-muted);
    font-size: var(--font-size-1);
  }

  .aspect-ratio-tool__dimension-fields {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .aspect-ratio-tool__error {
    margin: 0;
    color: var(--color-danger);
    font-size: var(--font-size-1);
  }

  .aspect-ratio-tool__stats {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .aspect-ratio-tool__stat-row {
    display: flex;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .aspect-ratio-tool__stat-label {
    color: var(--color-fg-muted);
    font-size: var(--font-size-1);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .aspect-ratio-tool__stat-value {
    color: var(--color-fg-primary);
    font-size: var(--font-size-2);
  }
</style>
