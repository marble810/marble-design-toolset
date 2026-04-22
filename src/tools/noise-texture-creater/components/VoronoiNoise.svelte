<script lang="ts">
	import { loadTechStack } from '$lib/runtime/tech-stack';
    import type { TechStackModule } from '$lib/types/tech-stack';
	import { onMount } from 'svelte';
    import type { Application } from 'pixi.js';

    type PixiModule = TechStackModule<'pixi'>;
    type VoronoiController = {
        renderer: Application['renderer'];
        updateNoiseScale: (nextNoiseScale: number) => void;
    };

    interface Props {
        width: number;
        height: number;
        noiseScale: number;
    }

    let { width, height, noiseScale }: Props = $props();

    let hostElement = $state<HTMLElement | null>(null);
    let isReady = $state(false);
    let errorMessage = $state('');

    let voronoi: VoronoiController | null = null;

    $effect(()=>{
        if (isReady && voronoi) {
            updatePixiRender(width, height, noiseScale);
        }
    });

    // $effect(() => {
    //     if (exportRequested)
    // })

  function updatePixiRender(width: number, height: number, noiseScale: number) {
    if(!voronoi) return;
    voronoi.renderer.resize(width, height);
    voronoi.updateNoiseScale(noiseScale);
  }

  onMount(async()=>{
    let disposed = false;

    void (async()=>{
        try{
            const PIXI: PixiModule = await loadTechStack('pixi');
            if (disposed || !hostElement) return;
            void PIXI;
        } catch(e){
            errorMessage = 'Failed to load Pixi.js library.';
            console.error(e);
            return;
        }
    })
  })


</script>